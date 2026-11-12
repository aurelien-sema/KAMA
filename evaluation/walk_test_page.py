"""Parcourt les 5 etapes de la page officielle de test, en francais et en anglais.

Donnees fictives uniquement. Aucune modification de la page, aucun outil reserve au jury.
Sortie : un fichier JSON avec les textes visibles et leur place dans la page.
"""
import json
import sys

from playwright.sync_api import sync_playwright

URL = "https://safinum.cm/hackathon-test"
OUT = sys.argv[1]

DUMP = """
() => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const out = [];
  const path = (el) => { const p=[]; let e=el, n=0; while (e && e!==document.body && n<4) { p.unshift(e.tagName.toLowerCase()); e=e.parentElement; n++; } return p.join('>'); };
  while (walker.nextNode()) {
    const n = walker.currentNode, t = n.textContent.replace(/\\s+/g,' ').trim(), el = n.parentElement;
    if (!t || !el || ['SCRIPT','STYLE','NOSCRIPT'].includes(el.tagName)) continue;
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    if (r.width===0 || s.visibility==='hidden' || s.display==='none') continue;
    out.push({text:t, tag:el.tagName.toLowerCase(), path:path(el), parent:(el.parentElement?.textContent||'').replace(/\\s+/g,' ').trim().slice(0,140), mono:/mono|tabular/.test(el.className||'')});
  }
  const fields = [...document.querySelectorAll('input,select,textarea,button')].filter(e=>e.getBoundingClientRect().width>0).map(e=>({tag:e.tagName.toLowerCase(), type:e.type||'', placeholder:e.placeholder||'', aria:e.getAttribute('aria-label')||'', name:e.name||'', id:e.id||'', text:(e.textContent||'').replace(/\\s+/g,' ').trim().slice(0,80), value:e.tagName==='SELECT'?[...e.options].map(o=>o.text):'' }));
  return {texts:out, fields};
}
"""


def snap(page, name, store):
    page.wait_for_timeout(500)
    store[name] = page.evaluate(DUMP)
    print(name, len(store[name]["texts"]), "textes", len(store[name]["fields"]), "controles", flush=True)


def click(page, *labels):
    for label in labels:
        loc = page.get_by_role("button", name=label)
        if loc.count():
            loc.first.click()
            return label
    raise RuntimeError(f"bouton introuvable : {labels}")


def walk(page, lang, store):
    page.goto(URL, wait_until="networkidle", timeout=90000)
    page.wait_for_timeout(1500)
    fr = lang == "fr"
    if not fr:
        click(page, "EN", "English", "Anglais")
        page.wait_for_timeout(800)
    snap(page, f"{lang}_1_tableau_de_bord", store)
    click(page, "Effectuer un transfert" if fr else "Make a transfer")
    snap(page, f"{lang}_2_frais", store)
    select = page.locator("select").first
    for value in select.locator("option").evaluate_all("o => o.map(x => x.value)"):
        select.select_option(value)
        snap(page, f"{lang}_2_frais_{value}", store)
    select.select_option(index=0)
    page.locator("input[type=number]").first.fill("25000")
    click(page, "Continuer" if fr else "Continue")
    snap(page, f"{lang}_3_beneficiaire", store)
    click(page, "Continuer" if fr else "Continue")  # erreur volontaire : champs vides
    snap(page, f"{lang}_3_erreur_champs_vides", store)
    inputs = page.locator("main input:not([type=checkbox]):not([type=number]), input[type=tel], input[type=text]")
    inputs.nth(0).fill("Client Fictif")
    page.locator("input[type=tel]").first.fill("600000000")
    page.locator("input[type=checkbox]").first.check()
    click(page, "Continuer" if fr else "Continue")
    snap(page, f"{lang}_4_recapitulatif", store)
    click(page, "Confirmer le transfert" if fr else "Confirm transfer")  # erreur volontaire : case non cochee
    snap(page, f"{lang}_4_erreur_confirmation", store)
    page.locator("input[type=checkbox]").first.check()
    click(page, "Confirmer le transfert" if fr else "Confirm transfer")
    page.wait_for_timeout(1500)
    snap(page, f"{lang}_5_recu", store)


store = {}
with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_page(locale="fr-FR", viewport={"width": 1366, "height": 900})
    for lang in ("fr", "en"):
        try:
            walk(page, lang, store)
        except Exception as exc:
            print("ECHEC", lang, type(exc).__name__, str(exc)[:400], flush=True)
            page.screenshot(path=OUT + f".{lang}.png", full_page=True)
    browser.close()
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(store, f, ensure_ascii=False, indent=1)
print("ecrit", OUT, list(store))
