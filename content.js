// --- ANTI-PAUSE ---
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

// --- RASTREADOR DE MÍDIA ATIVA ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getPlayingMedia") {
        const mediaElements = Array.from(document.querySelectorAll('video, audio'));
        
        // Pega o player que está tocando agora, ou se o usuário pausou, pega o primeiro válido
        const targetMedia = mediaElements.find(m => !m.paused && m.readyState > 0) || mediaElements.find(m => m.readyState > 0);

        if (targetMedia) {
            // Se o src for direto (XVideos, etc)
            if (targetMedia.src && !targetMedia.src.startsWith('blob:')) {
                sendResponse({ url: targetMedia.src });
                return true;
            }

            let foundUrl = null;
            
            // O SEGREDO AQUI: Busca a fronteira semântica exata do Post/Artigo onde o vídeo está contido
            const container = targetMedia.closest('[role="article"], article, div[data-pagelet^="FeedUnit"], div[data-pagelet^="Reels"]');
            
            if (container) {
                // Varre a caixa do post procurando pelo link original (data, título, botão compartilhar)
                const linkRegex = /\/(watch|reel|reels|videos|permalink|posts|p)\/|fbid=/;
                const links = container.querySelectorAll('a[href]');
                for (let a of Array.from(links)) {
                    if (a.href.match(linkRegex)) {
                        foundUrl = a.href;
                        break; 
                    }
                }
            }

            // Se achou a ID escondida usa ela, senão recai pra URL da aba
            sendResponse({ url: foundUrl || window.location.href });
        } else {
            sendResponse({ url: window.location.href });
        }
    }
    return true; 
});
