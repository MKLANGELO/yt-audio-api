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
    if (request.action === "getPlayingMedia") {
        const mediaElements = Array.from(document.querySelectorAll('video, audio'));
        const playingMedia = mediaElements.find(m => !m.paused && !m.ended && m.readyState > 0);

        if (playingMedia) {
            if (playingMedia.src && !playingMedia.src.startsWith('blob:')) {
                sendResponse({ url: playingMedia.src });
                return true;
            }

            // RASTREADOR PROFUNDO: Varre a estrutura do Facebook Feed para achar a ID do post ativo
            let currentElement = playingMedia;
            let foundUrl = null;
            const linkRegex = /\/(watch|reel|reels|videos|permalink|posts)\/|fbid=/;

            // Sobe até 20 níveis na caixa do post procurando o link original
            for (let i = 0; i < 20; i++) {
                if (!currentElement) break;
                
                const links = currentElement.querySelectorAll('a[href]');
                for (let a of Array.from(links)) {
                    let href = a.href;
                    if (href.match(linkRegex)) {
                        foundUrl = href;
                        break;
                    }
                }
                if (foundUrl) break;
                currentElement = currentElement.parentElement;
            }

            sendResponse({ url: foundUrl || window.location.href });
        } else {
            sendResponse({ url: window.location.href });
        }
    }
    return true; 
});
