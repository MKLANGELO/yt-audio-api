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
