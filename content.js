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
            // Se o link for direto e limpo
            if (playingMedia.src && !playingMedia.src.startsWith('blob:')) {
                sendResponse({ url: playingMedia.src });
                return true;
            }

            // O Facebook esconde os links reais em atributos href próximos ao player. Vamos procurar.
            let currentElement = playingMedia;
            let foundUrl = null;
            const linkRegex = /\/(watch|reel|reels|p|videos|stories|permalink)\//;

            for (let i = 0; i < 15; i++) {
                if (!currentElement) break;
                
                // Procura na tag A
                if (currentElement.tagName === 'A' && currentElement.href && currentElement.href.match(linkRegex)) {
                    foundUrl = currentElement.href;
                    break;
                }

                // Procura nos links filhos da caixa do post
                const links = currentElement.querySelectorAll('a[href]');
                for (let a of Array.from(links)) {
                    if (a.href.match(linkRegex)) {
                        foundUrl = a.href;
                        break;
                    }
                }
                if (foundUrl) break;
                currentElement = currentElement.parentElement; // Sobe um nível no HTML
            }

            sendResponse({ url: foundUrl || window.location.href });
        } else {
            sendResponse({ url: window.location.href });
        }
    }
    return true; 
});
