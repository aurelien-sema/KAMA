const SERVER = "https://kama-project.duckdns.org";
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "translate") {
    fetch(SERVER + "/v1/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg.payload)
    })
      .then(r => r.json())
      .then(sendResponse)
      .catch(e => sendResponse({ error: String(e) }));
    return true;
  }
});
