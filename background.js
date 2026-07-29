// Banco de dados em memória (Cache Interno de Cookies)
let cookieCache = {};

// Sistema de validação para checar se o usuário está realmente logado
function validateSession(domain, cookies) {
  const cookieStr = cookies.map(c => c.name).join(";");
  if (domain.includes("facebook.com") && !cookieStr.includes("c_user")) return false;
  if (domain.includes("instagram.com") && !cookieStr.includes("sessionid")) return false;
  if (domain.includes("youtube.com") && !cookieStr.includes("LOGIN_INFO")) return false;
  return true; // Se for site público (xvideos, etc), libera
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchMedia") {
    const urlObj = new URL(request.url);
    const domain = urlObj.hostname.replace('www.', '');

    // Busca os logs/cookies diretamente dentro da aba do navegador
    chrome.cookies.getAll({ domain: domain }, (cookies) => {
      
      // Verifica se está logado antes de tentar baixar e travar o servidor
      if (!validateSession(domain, cookies)) {
         sendResponse({ 
           success: true, 
           responseOk: false, 
           status: 400, 
           data: { error: `Você não está logado no ${domain}. Faça o login na aba primeiro.` } 
         });
         return;
      }

      // Formata e salva os logs do cliente no cache interno
      let cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      cookieCache[domain] = cookieHeader;

      // Envia requisição para a API com o cache validado
      fetch(`https://baixatudo-bvx4.onrender.com/?url=${encodeURIComponent(request.url)}&mode=${request.mode}`, {
        method: 'GET',
        headers: { 'X-Browser-Cookies': cookieCache[domain] }
      })
      .then(res => res.json().then(data => ({ status: res.status, ok: res.ok, data })))
      .then(result => sendResponse({ success: true, responseOk: result.ok, status: result.status, data: result.data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    });
    return true; // Mantém o canal de comunicação aberto
  }
});
