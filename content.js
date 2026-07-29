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

// Rastreador avançado focado em players protegidos (AlpaClass, etc)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getPlayingMedia") {
        const videoElement = document.querySelector('video');
        if (videoElement) {
            // Se o player estiver usando blob ou link direto interno do player
            if (videoElement.src && !videoElement.src.startsWith('blob:')) {
                sendResponse({ url: videoElement.src });
                return true;
            }
            
            // Tenta varrer iframes ou fontes alternativas do player protegido
            const sourceElements = document.querySelectorAll('video source');
            for (let srcEl of sourceElements) {
                if (srcEl.src) {
                    sendResponse({ url: srcEl.src });
                    return true;
                }
            }
        }
        sendResponse({ url: window.location.href });
    }
    return true;
});
