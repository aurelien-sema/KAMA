"""Assistant (LLM) : rien de non masqué n'entre, aucun chiffre ni balise inventée ne sort, texte critique laissé en anglais."""
import base64
import json

import pytest

from conftest import FakeRecognizer, engines_with, route, wav_bytes

CONTEXTE = {"screen": "frais", "elements": [{"id": "frais", "label": "Frais"}, {"id": "total", "label": "Total à débiter"}]}


class FakeLlm:
    def __init__(self, reply):
        self.reply, self.requests = reply, []

    def complete(self, request):
        self.requests.append(request)
        return json.dumps(self.reply) if isinstance(self.reply, dict) else self.reply


def construire(content_dir, reply, translation=None, asr=None):
    from app.main import create_app
    from app.services import build_services
    from app.settings import Settings
    from fastapi.testclient import TestClient

    settings = Settings(content_dir=content_dir)
    services = build_services(settings, engines_with(translation=translation or {}, asr=asr or {}))
    llm = FakeLlm(reply)
    services.assistant.client = llm
    return TestClient(create_app(settings, services), raise_server_exceptions=False), llm


def demander(client, text, lang="wes", contexte=CONTEXTE):
    return client.post("/v1/assistant", json={"text": text, "lang": lang, "context": contexte})


def test_reponse_non_critique_traduite_en_pidgin(content_dir):
    client, llm = construire(content_dir, {"kind": "answer", "text": "Look at the total before you continue."},
                             translation={"en>wes": route(lambda t: "Look di total before you continue.")})
    r = demander(client, "what do I look at").json()
    assert r == {"kind": "answer", "text": "Look di total before you continue.", "badge": "machine", "text_lang": "wes"}
    assert "value" not in llm.requests[0]["context"]["elements"][0]  # aucun montant envoyé au LLM


def test_reponse_sans_montant_permise(content_dir):
    client, _ = construire(content_dir, {"kind": "answer", "text": "Look at the total. Touch the Kama badge next to it to hear the exact amount."})
    assert demander(client, "why").json()["kind"] == "answer"


def test_reponse_critique_reste_en_anglais(content_dir):
    texte = "The fees are what the bank takes. They are included in the total that leaves your account."
    client, _ = construire(content_dir, {"kind": "answer", "text": texte})
    assert demander(client, "why is there a charge").json() == {"kind": "answer", "text": texte, "badge": "untranslated", "text_lang": "en"}


@pytest.mark.parametrize("texte", [
    "You will pay 500 FCFA.", "The total is {x9}.", "The fees are {x1}.", "", "   ",
    "So {x3} = {x1} + {x2}.", "The total ({x3}) is {x1} plus fees ({frais} = {x2}).",
    "The missing amount is {x1}.", "Take {x1} minus {x2}.", "Wait, actually the total is {x2}.",
])
def test_chiffre_balise_inventee_ou_vide_donne_unknown(content_dir, texte):
    client, _ = construire(content_dir, {"kind": "answer", "text": texte})
    assert demander(client, "how much").json()["kind"] == "unknown"


def test_sortie_illisible_donne_unknown(content_dir):
    client, _ = construire(content_dir, "pas du json")
    assert demander(client, "how much").json()["kind"] == "unknown"


def test_question_non_masquee_refusee_sans_appel(content_dir):
    client, llm = construire(content_dir, {"kind": "unknown"})
    r = demander(client, "I want to send 25000 FCFA to Paul Ndam")
    assert r.status_code == 422 and r.json()["error"]["code"] == "unmasked_content" and llm.requests == []


def test_aucune_valeur_acceptee_dans_le_contexte(content_dir):
    client, llm = construire(content_dir, {"kind": "unknown"})
    contexte = {"elements": [{"id": "solde", "label": "Solde", "value": "{x1}"}]}
    assert demander(client, "my balance", contexte=contexte).status_code == 422 and llm.requests == []


def test_assistant_indisponible_sans_llm(client):
    r = client.post("/v1/assistant", json={"text": "hello", "lang": "wes"})
    assert r.status_code == 503 and r.json()["error"]["code"] == "llm_unavailable"


def test_voix_hors_liste_repond_avec_l_assistant(content_dir):
    client, llm = construire(content_dir, {"kind": "answer", "text": "Look at the total line."},
                             asr={"wes": FakeRecognizer("tell me something about Paul 25000")})
    entete = base64.urlsafe_b64encode(json.dumps(CONTEXTE).encode()).decode().rstrip("=")
    r = client.post("/v1/voice/intent", content=wav_bytes(), headers={"X-Kama-Lang": "wes", "Content-Type": "audio/wav", "X-Kama-Context": entete}).json()
    assert r["intent"] == "unknown" and r["answer"]["text"] == "Look at the total line."
    envoye = llm.requests[0]["text"]
    assert "25000" not in envoye  # montant masqué avant le LLM
    # Limite connue (ARCHITECTURE.md, section 8) : un prénom seul sans contexte n'est pas détecté par le masquage.
    # Le LLM tourne sur le serveur Kama : la question ne sort pas vers un tiers.


def test_voix_connue_n_appelle_pas_le_llm(content_dir):
    client, llm = construire(content_dir, {"kind": "answer", "text": "x"}, asr={"wes": FakeRecognizer("how much money i get")})
    entete = base64.urlsafe_b64encode(json.dumps(CONTEXTE).encode()).decode()
    r = client.post("/v1/voice/intent", content=wav_bytes(), headers={"X-Kama-Lang": "wes", "Content-Type": "audio/wav", "X-Kama-Context": entete}).json()
    assert r == {"intent": "ask_balance", "confidence": 1.0} and llm.requests == []


def test_question_ecrite_reconnue_par_la_liste_d_intentions(content_dir):
    client, llm = construire(content_dir, {"kind": "answer", "text": "x"})
    r = demander(client, "how much money i get").json()
    assert r["kind"] == "intent" and r["intent"] == "ask_balance" and llm.requests == []


def test_reponse_coupee_s_arrete_a_la_derniere_phrase(content_dir):
    client, _ = construire(content_dir, {"kind": "answer", "text": "Look at the total line. It includes the fees. The total amount taken out is 'f"})
    assert demander(client, "why").json()["text"] == "Look at the total line. It includes the fees."
