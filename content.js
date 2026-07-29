// --- ANTI-PAUSE (Garante que o vídeo continue rodando ao clicar no plugin) ---
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
                if (!document.hasFocus()) return; // Ignora o pause se a aba perder o foco pro plugin
                return originalPause.apply(this, arguments);
            };
        }
    });
}
setInterval(blockPause, 1000);

// --- RASTREADOR DE MÍDIA ATIVA ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getPlayingMedia") {
        // Busca todos os players da tela
        const mediaElements = Array.from(document.querySelectorAll('video, audio'));
        
        // DETECÇÃO CIRÚRGICA: Filtra apenas o que NÃO está pausado e NÃO acabou
        const playingMedia = mediaElements.find(m => !m.paused && !m.ended && m.readyState > 0);

        if (playingMedia) {
            // 1. Se for uma URL direta limpa (não blob), pega na hora
            if (playingMedia.src && !playingMedia.src.startsWith('blob:')) {
                sendResponse({ url: playingMedia.src });
                return true;
            }

            // 2. Se for um Blob protegido (Face/Insta), rastreia a interface ao redor para achar o link original do post
            let currentElement = playingMedia;
            let foundUrl = null;
            const linkRegex = /\/(watch|reel|reels|p|videos|stories|permalink)\//;

            // Sobe nas caixas do site até achar o link do post respectivo
            for (let i = 0; i < 10; i++) {
                if (!currentElement) break;
                
                if (currentElement.tagName === 'A' && currentElement.href && currentElement.href.match(linkRegex)) {
                    foundUrl = currentElement.href;
                    break;
                }

                const links = currentElement.querySelectorAll('a[href]');
                for (let a of Array.from(links)) {
                    if (a.href.match(linkRegex)) {
                        foundUrl = a.href;
                        break;
                    }
                }
                if (foundUrl) break;
                currentElement = currentElement.parentElement;
            }

            // Retorna o link oculto que achou ou cai para a URL padrão
            sendResponse({ url: foundUrl || window.location.href });
        } else {
            // Nenhum player tocando
            sendResponse({ url: window.location.href });
        }
    }
    return true; 
});
