const sel = document.getElementById("lang");
chrome.storage.local.get(["lang"], r => { if (r.lang) sel.value = r.lang; });
sel.addEventListener("change", () => chrome.storage.local.set({ lang: sel.value }));
