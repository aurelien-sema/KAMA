const btn = document.createElement("button");
btn.textContent = "Expliquer cette page";
btn.style.cssText = "position:fixed;right:16px;top:50%;z-index:2147483647";
btn.onclick = () => {
  chrome.runtime.sendMessage({ type: "translate", payload: { text: "Bonjour", source_lang: "fr", target_lang: "bbj", element: "text" } }, console.log);
};
document.body.appendChild(btn);
