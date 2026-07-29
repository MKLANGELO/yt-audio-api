// Sobrescreve as propriedades de visibilidade e impede o desfoque
Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: false });
Object.defineProperty(document, 'hidden', { value: false, writable: false });

window.addEventListener('blur', (e) => e.stopImmediatePropagation(), true);
document.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true);

// INJEÇÃO AGRESSIVA: Desativa a função nativa pause() dos vídeos temporariamente
function blockPause() {
    const videos = document.querySelectorAll('video');
    videos.forEach(v => {
        if (!v.dataset.pauseBlocked) {
            v.dataset.pauseBlocked = "true";
            const originalPause = v.pause;
            v.pause = function() {
                // Impede o pause se a página perdeu o foco (plugin clicado)
                if (!document.hasFocus()) {
                    console.log("Pause evitado pelo Media Downloader.");
                    return;
                }
                return originalPause.apply(this, arguments);
            };
        }
    });
}

// Fica verificando se novos vídeos apareceram (útil em Stories)
setInterval(blockPause, 1000);
