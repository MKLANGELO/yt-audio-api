let cookieCache = {};

function validateSession(domain, cookies) {
  const cookieStr = cookies.map(c => c.name).join(";");
  if (domain.includes("facebook.com") && !cookieStr.includes("c_user")) return false;
  if (domain.includes("instagram.com") && !cookieStr.includes("sessionid")) return false;
  if (domain.includes("youtube.com") && !cookieStr.includes("LOGIN_INFO")) return false;
  return true;
}

function cleanUrl(rawUrl) {
  try {
    let urlObj = new URL(rawUrl);
    if (urlObj.hostname.includes('facebook.com') || urlObj.hostname.includes('instagram.com')) {
       return rawUrl.split('?')[0]; 
    }
    return rawUrl;
  } catch(e) {
    return rawUrl;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchMedia") {
    const urlObj = new URL(request.url);
    const domain = urlObj.hostname.replace('www.', '');
    
    const urlLimpa = cleanUrl(request.url);

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

      // MODIFICAÇÃO: Só injeta os cookies se for rede social restrita.
      // Sites como XVideos vão sem cookies para não ativar o Firewall/Geo-block.
      let cookieHeader = "";
      if (domain.includes("facebook.com") || domain.includes("instagram.com") || domain.includes("youtube.com")) {
          cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      }
      
      cookieCache[domain] = cookieHeader;

      fetch(`https://baixatudo-bvx4.onrender.com/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            url: urlLimpa,
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
