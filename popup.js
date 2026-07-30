document.addEventListener("DOMContentLoaded", async () => {
  const statusEl = document.getElementById("status");
  const progressContainer = document.getElementById("progress-container");
  const progressBar = document.getElementById("progress-bar");

  let progressInterval;
  let currentProgress = 0;

  // Direciona a URL capturada para o campo de texto correto da rede social
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
        const url = tab.url;
        if (url.includes("tiktok.com")) document.getElementById("url-tk").value = url;
        else if (url.includes("instagram.com")) document.getElementById("url-ig").value = url;
        else if (url.includes("youtube.com") || url.includes("youtu.be")) document.getElementById("url-yt").value = url;
        else if (url.includes("facebook.com")) document.getElementById("url-fb").value = url;
        else {
            document.getElementById("url-gen").value = url;
            document.getElementById("url-rec").value = url;
        }
    }
  } catch (err) {}

  function updateProgress(targetPercentage, speedMs) {
    clearInterval(progressInterval);
    progressInterval = setInterval(() => {
      if (currentProgress < targetPercentage) {
        currentProgress++;
        if (progressBar) progressBar.style.width = currentProgress + "%";
      } else {
        clearInterval(progressInterval);
      }
    }, speedMs);
  }

  const processDownload = async (actionType, inputId) => {
    const urlInput = document.getElementById(inputId);
    const rawUrl = urlInput ? urlInput.value.trim() : "";
    
    if (!rawUrl) { 
        statusEl.innerText = "❌ Cole um link no campo acima do botão clicado!"; 
        statusEl.style.color = "#ff4c3a";
        return; 
    }

    const modeSelected = document.querySelector('input[name="mode"]:checked').value;
    const shouldAskFolder = document.getElementById("ask-folder").checked;

    currentProgress = 0;
    if (progressContainer) progressContainer.style.display = "block";
    if (progressBar) progressBar.style.width = "0%";

    statusEl.innerText = actionType === "fetchMedia" ? "🔄 Processando Mídia..." : "🔴 Gravando Stream...";
    statusEl.style.color = "#25f4ee";
    updateProgress(85, 150);

    chrome.runtime.sendMessage({ action: actionType, url: rawUrl, mode: modeSelected }, (res) => {
      clearInterval(progressInterval);

      if (!res || !res.success || !res.responseOk) {
        statusEl.innerText = "❌ Falha. Verifique o link ou tente o modo Gravar Stream.";
        statusEl.style.color = "#ff4c3a";
        return;
      }

      if (res.data && res.data.token) {
        if (progressBar) progressBar.style.width = "100%";
        statusEl.innerText = "✅ Download iniciado!";
        statusEl.style.color = "#0be09b";
        
        chrome.downloads.download({
          url: res.data.token,
          filename: res.data.file.replace(/^rec_\d+_+/, ''),
          saveAs: shouldAskFolder
        }, () => {
          statusEl.innerText = "✅ Arquivo salvo com sucesso!";
        });
      }
    });
  };

  // Cada botão agora "lê" apenas o link que está na caixa de texto logo abaixo dele
  const buttons = document.querySelectorAll("button");
  buttons.forEach(btn => {
      btn.onclick = (e) => {
          e.preventDefault();
          const inputId = btn.getAttribute("data-input");
          const actionType = btn.id === "btn-record" ? "recordServerStream" : "fetchMedia";
          processDownload(actionType, inputId);
      };
  });
});
