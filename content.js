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
    // 🥷 SNIPER DO YOUTUBE (INJEÇÃO DIRETA NO PLAYER)
    // ---------------------------------------------------------
    else if (request.action === "extractYouTubeRaw") {
        // Cria um ouvinte para receber a resposta do script injetado
        const listener = function(event) {
            if (event.source === window && event.data.type === 'YOUTUBE_SNIPER_RESULT') {
                window.removeEventListener('message', listener);
                sendResponse({ 
                    success: !!event.data.link, 
                    link: event.data.link, 
                    error: event.data.error 
                });
            }
        };
        window.addEventListener('message', listener);

        // Injeta um script no mundo principal (Main World) da página para acessar a API do YouTube
        const script = document.createElement('script');
        script.textContent = `
            try {
                // Acessa o cérebro do player atual (o mesmo que gera o 'Copiar URL do vídeo')
                const player = document.getElementById('movie_player');
                
                // Puxa a resposta de streaming ao vivo e atualizada do player
                const response = player ? player.getPlayerResponse() : (window.ytInitialPlayerResponse || {});
                
                let directLink = null;
                
                if (response && response.streamingData && response.streamingData.formats) {
                    const formats = response.streamingData.formats;
                    
                    // Procura o arquivo unificado (Áudio + Vídeo) que o YouTube mantém por compatibilidade
                    const bestFormat = formats.find(f => f.mimeType && f.mimeType.includes('video/mp4') && f.url);
                    
                    if (bestFormat) {
                        directLink = bestFormat.url;
                    }
                }
                
                // Envia de volta para a extensão
                window.postMessage({ type: 'YOUTUBE_SNIPER_RESULT', link: directLink }, '*');
            } catch(e) {
                window.postMessage({ type: 'YOUTUBE_SNIPER_RESULT', link: null, error: e.message }, '*');
            }
        `;
        
        document.documentElement.appendChild(script);
        script.remove(); // Limpa o rastro do script
        
        return true; // Mantém a porta de comunicação aberta para aguardar a resposta
    }
    
    return true; 
});
