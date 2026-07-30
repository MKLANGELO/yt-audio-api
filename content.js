Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: false });
Object.defineProperty(document, 'hidden', { value: false, writable: false });

window.addEventListener('blur', (e) => e.stopImmediatePropagation(), true);
document.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true);

function blockPause() {
    const videos = document.querySelectorAll('video');
    videos.forEach(v => {
        if (!v.dataset.pauseBlocked) {
            v.dataset.pauseBlocked = "true";
            const originalPause = v.pause;
            v.pause = function() {
                if (!document.hasFocus()) return; 
                return originalPause.apply(this, arguments);
            };
        }
    });
}
setInterval(blockPause, 1000);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // ---------------------------------------------------------
    // 🥷 SNIPER DO TIKTOK
    // ---------------------------------------------------------
    if (request.action === "extractTikTokRaw") {
        try {
            let directLink = null;
            const rehydration = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
            if (rehydration) {
                const data = JSON.parse(rehydration.textContent);
                const item = data?.__DEFAULT_SCOPE__?.webapp?.videoDetail?.itemInfo?.itemStruct;
                if (item?.video?.playAddr) directLink = item.video.playAddr;
            }
            if (!directLink) {
                const sigi = document.getElementById('SIGI_STATE');
                if (sigi) {
                    const data = JSON.parse(sigi.textContent);
                    const items = data?.ItemModule;
                    if (items) {
                        const key = Object.keys(items)[0];
                        if (items[key]?.video?.playAddr) directLink = items[key].video.playAddr;
                    }
                }
            }
            sendResponse({ success: !!directLink, link: directLink });
        } catch(e) {
            sendResponse({ success: false, error: e.message });
        }
    }
    
    // ---------------------------------------------------------
    // 🥷 SNIPER DO YOUTUBE
    // ---------------------------------------------------------
    else if (request.action === "extractYouTubeRaw") {
        try {
            let directLink = null;
            
            // Varre todos os scripts da página atrás do pacote ytInitialPlayerResponse
            const scripts = Array.from(document.querySelectorAll('script'));
            const targetScript = scripts.find(s => s.textContent.includes('ytInitialPlayerResponse = {'));
            
            if (targetScript) {
                // Tenta extrair o objeto JSON exato usando expressão regular
                const match = targetScript.textContent.match(/ytInitialPlayerResponse\s*=\s*(\{.*?\});/);
                if (match && match[1]) {
                    const data = JSON.parse(match[1]);
                    const formats = data?.streamingData?.formats || [];
                    
                    // Caça o melhor formato MP4 que já tem áudio e vídeo juntos E que não esteja criptografado
                    const bestFormat = formats.find(f => f.mimeType && f.mimeType.includes('video/mp4') && f.url);
                    
                    if (bestFormat) {
                        directLink = bestFormat.url;
                    }
                }
            }
            sendResponse({ success: !!directLink, link: directLink });
        } catch(e) {
            sendResponse({ success: false, error: e.message });
        }
    }
    
    return true; 
});
