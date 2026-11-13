from conftest import engines_with, route


def post(client, text, target="bbj", source="fr", **kw):
    return client.post("/v1/translate", json={"text": text, "source_lang": source, "target_lang": target, **kw})


def test_exact_memory_is_verified(client):
    r = post(client, "Les frais de cette opération sont de {x1}.").json()
    assert (r["text"], r["badge"], r["origin"]) == ("BBJ-FRAIS {x1}", "verified", "memory")


def test_word_order_of_slots_is_preserved_by_number(client):
    assert post(client, "Vous allez envoyer {x1} à {x2}.").json()["text"] == "BBJ {x2} BBJ {x1}"


def test_english_source_uses_the_same_memory(client):
    assert post(client, "Fees are not refundable.", source="en").json()["badge"] == "verified"


def test_unmasked_amount_is_refused_without_echo(client):
    r = post(client, "Votre solde est de 25 500 FCFA.")
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "unmasked_content"
    assert "25 500" not in r.text


def test_unmasked_name_is_refused(client):
    assert post(client, "Envoyer à Paul Mbarga").status_code == 422


def test_near_memory_is_not_labelled_verified(client):
    r = post(client, "Les frais de votre opération sont de {x1}.").json()
    assert (r["badge"], r["origin"]) == ("machine", "near_memory")


def test_near_memory_refuses_maximum_for_minimum(client):
    r = post(client, "Le montant maximum d'un transfert est de {x1}.").json()
    assert r["text"] is None and r["reason"] == "critical_content"


def test_near_memory_refuses_change_of_tense(client):
    r = post(client, "Les frais de cette opération seront de {x1}.").json()
    assert r["text"] is None


def test_near_memory_refuses_opposite_meaning(client):
    r = post(client, "Les frais sont remboursables.").json()
    assert r["text"] is None and r["badge"] == "untranslated"


def test_unvalidated_translation_is_never_served(client):
    r = post(client, "Votre carte expire bientôt.").json()
    assert r["text"] is None and r["badge"] == "untranslated"


def test_critical_text_never_reaches_a_model(make_client):
    engine = route(lambda t: "ywə")
    client = make_client(engines_with({"fr>bbj": engine}))
    r = post(client, "Ne donnez votre code à personne.").json()
    assert r["reason"] == "critical_content" and engine.translator.calls == []


def test_element_type_makes_text_critical(make_client):
    engine = route(lambda t: "ywə")
    r = post(make_client(engines_with({"fr>bbj": engine})), "Bienvenue chez nous", element="confirm").json()
    assert r["reason"] == "critical_content" and engine.translator.calls == []


def test_non_critical_text_can_use_a_model(make_client):
    r = post(make_client(engines_with({"fr>bbj": route(lambda t: "ywə tsə")})), "Bienvenue chez nous").json()
    assert (r["text"], r["badge"], r["origin"]) == ("ywə tsə", "machine", "model")


def test_model_inventing_a_number_is_rejected(make_client):
    r = post(make_client(engines_with({"fr>bbj": route(lambda t: "ywə 500")})), "Bienvenue chez nous").json()
    assert r["text"] is None and r["reason"] == "guard_failed"


def test_model_repeating_itself_is_rejected(make_client):
    r = post(make_client(engines_with({"fr>bbj": route(lambda t: "a a a a")})), "Bienvenue chez nous").json()
    assert r["reason"] == "guard_failed"


def test_lost_placeholder_is_rejected_even_if_policy_allows_critical(make_client):
    client = make_client(engines_with({"fr>bbj": route(lambda t: "Zzɔp zhwenyə")}), mt_allow_critical=True)
    r = post(client, "Votre facture de {x1} est prête.").json()
    assert r["reason"] == "guard_failed"


def test_critical_term_must_be_rendered(make_client):
    client = make_client(
        engines_with({"fr>bbj": route(lambda t: "Close di money if you no know this person.")}),
        mt_allow_critical=True,
    )
    r = post(client, "Annulez ce transfert si vous ne connaissez pas cette personne.").json()
    assert r["text"] is None and r["reason"] == "guard_failed"


def test_suspended_is_not_rendered_as_wait(make_client):
    client = make_client(
        engines_with({"fr>bbj": route(lambda t: "Your account don di wait for some time.")}),
        mt_allow_critical=True,
    )
    r = post(client, "Votre compte a été suspendu temporairement.").json()
    assert r["text"] is None and r["reason"] == "guard_failed"


def test_negation_and_password_survive(make_client):
    output = "We no go ever ask you for ya code so that no person no go know-am with telephone."
    client = make_client(engines_with({"fr>bbj": route(lambda t: output)}), mt_allow_critical=True)
    r = post(client, "Nous ne vous demanderons jamais votre mot de passe par téléphone.").json()
    assert (r["text"], r["badge"], r["origin"]) == (output, "machine", "model")


def test_backtranslation_can_reject(make_client):
    translation = {
        "fr>bbj": route(lambda t: "ywə tsə", backtranslate="bbj>fr", min_backtranslation=0.5),
        "bbj>fr": route(lambda t: "Une phrase sans aucun rapport"),
    }
    assert post(make_client(engines_with(translation)), "Bienvenue chez nous").json()["reason"] == "guard_failed"


def test_backtranslation_can_accept(make_client):
    translation = {
        "fr>bbj": route(lambda t: "ywə tsə", backtranslate="bbj>fr", min_backtranslation=0.5),
        "bbj>fr": route(lambda t: "Bienvenue chez nous"),
    }
    assert post(make_client(engines_with(translation)), "Bienvenue chez nous").json()["badge"] == "machine"


def test_engine_crash_becomes_untranslated(make_client):
    def crash(_):
        raise RuntimeError("boom")

    r = post(make_client(engines_with({"fr>bbj": route(crash)})), "Bienvenue chez nous")
    assert r.status_code == 200 and r.json()["reason"] == "engine_error"


def test_no_engine_means_untranslated(client):
    assert post(client, "Bienvenue chez nous").json()["reason"] == "engine_unavailable"


def test_unknown_language(client):
    assert post(client, "Bonjour", target="xx").json()["error"]["code"] == "unsupported_language"


def test_a_source_text_listed_twice_does_not_hide_its_translation():
    from app.memory import Template, TranslationMemory

    empty = Template("a", {"fr": ("Frais",)}, {})
    filled = Template("b", {"fr": ("Frais",)}, {"wes": "Charge"})
    assert TranslationMemory([empty, filled], 0.86).find_exact("Frais", "fr", "wes") == "Charge"
