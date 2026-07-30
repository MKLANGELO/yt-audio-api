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

// NOVO: Escuta os comandos da extensão para raspar o link direto da memória (TikTok)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extractTikTokRaw") {
        try {
            let directLink = null;
            
            // Método 1: Busca no estado universal (Nova arquitetura do TikTok)
            const rehydration = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
            if (rehydration) {
                const data = JSON.parse(rehydration.textContent);
                const item = data?.__DEFAULT_SCOPE__?.webapp?.videoDetail?.itemInfo?.itemStruct;
                if (item?.video?.playAddr) directLink = item.video.playAddr;
            }
            
            // Método 2: Busca no SIGI_STATE (Arquitetura anterior/Fallback)
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
    return true; 
});
