chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchMedia") {
    const cloudApiUrl = "https://baixatudo-bvx4.onrender.com";
    const mode = request.mode === "video" ? "video" : "audio";
    const targetUrl = request.url;

    let domainMatch = targetUrl.match(/https?:\/\/(?:www\.)?([^/]+)/);
    let domain = domainMatch ? domainMatch[1] : "";

    if (domain.includes("youtube.com") || domain.includes("youtu.be")) domain = ".youtube.com";
    else if (domain.includes("instagram.com")) domain = ".instagram.com";
    else if (domain.includes("facebook.com")) domain = ".facebook.com";
    else if (domain.includes("xvideos.com")) domain = ".xvideos.com";
    else if (domain.includes("alpaclass.com")) domain = ".alpaclass.com";

    chrome.cookies.getAll({ domain: domain }, async (cookies) => {
      let cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");

      try {
        const response = await fetch(`${cloudApiUrl}/?url=${encodeURIComponent(targetUrl)}&mode=${mode}`, {
          method: "GET",
          headers: {
            "Accept": "application/json",
            "X-Browser-Cookies": cookieHeader
          }
        });

        const data = await response.json();
        sendResponse({ success: true, responseOk: response.ok, status: response.status, data: data });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    });

    return true;
  }
});
