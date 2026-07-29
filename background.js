let cookieCache = {};

function validateSession(domain, cookies) {
  const cookieStr = cookies.map(c => c.name).join(";");
  if (domain.includes("facebook.com") && !cookieStr.includes("c_user")) return false;
  if (domain.includes("instagram.com") && !cookieStr.includes("sessionid")) return false;
  if (domain.includes("youtube.com") && !cookieStr.includes("LOGIN_INFO")) return false;
  return true;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchMedia") {
    const urlObj = new URL(request.url);
    const domain = urlObj.hostname.replace('www.', '');

    chrome.cookies.getAll({ domain: domain }, (cookies) => {
      
      if (!validateSession(domain, cookies)) {
         sendResponse({ 
           success: true, 
           responseOk: false, 
           status: 400, 
           data: { error: `Você não está logado no ${domain}. Faça o login na aba primeiro.` } 
         });
         return;
      }

      let cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      cookieCache[domain] = cookieHeader;

      // Mudança crítica: Usando POST para suportar cookies gigantes no Body
      fetch(`https://baixatudo-bvx4.onrender.com/`, {
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
    return true; 
  }
});
