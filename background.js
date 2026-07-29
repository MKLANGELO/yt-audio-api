let cookieCache = {};
const api = (typeof browser !== 'undefined') ? browser : chrome;

api.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchMedia" || request.action === "recordServerStream") {
    try {
      const urlObj = new URL(request.url);
      const domain = urlObj.hostname.replace('www.', '');
      const endpoint = request.action === "recordServerStream" ? "record-stream" : "";

      api.cookies.getAll({ domain: domain }, (cookies) => {
        cookieCache[domain] = cookies || [];

        fetch(`https://baixatudo-bvx4.onrender.com/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              url: request.url,
              mode: request.mode,
              cookies: cookieCache[domain]
          })
        })
        .then(res => res.json().then(data => ({ status: res.status, ok: res.ok, data })))
        .then(result => sendResponse({ success: true, responseOk: result.ok, status: result.status, data: result.data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      });
    } catch (e) {
      sendResponse({ success: false, error: "URL inválida fornecida." });
    }
    return true; 
  }
});
