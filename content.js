// Sobrescreve a API de visibilidade do navegador
Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: false });
Object.defineProperty(document, 'hidden', { value: false, writable: false });

// Bloqueia eventos que avisam ao site que a janela perdeu o foco
document.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true);
window.addEventListener('blur', (e) => e.stopImmediatePropagation(), true);
window.addEventListener('focusout', (e) => e.stopImmediatePropagation(), true);
