document.addEventListener("DOMContentLoaded", async () => {
  const statusEl = document.getElementById("status");
  const urlInput = document.getElementById("media-url");
  const progressContainer = document.getElementById("progress-container");
  const progressBar = document.getElementById("progress-bar");

  let progressInterval;
  let currentProgress = 0;

  // Autopreencher URL
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && urlInput) {
      urlInput.value = tab.url;
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

  // Função centralizada para processar os botões
  const processDownload = async (actionType) => {
    const rawUrl = urlInput ? urlInput.value.trim() : "";
    if (!rawUrl) { 
        statusEl.innerText = "❌ Insira uma URL válida!"; 
        statusEl.style.color = "#ef4444";
        return; 
    }

    const modeSelected = document.querySelector('input[name="mode"]:checked').value;
    const shouldAskFolder = document.getElementById("ask-folder").checked;

    currentProgress = 0;
    if (progressContainer) progressContainer.style.display = "block";
    if (progressBar) progressBar.style.width = "0%";

    statusEl.innerText = actionType === "fetchMedia" ? "🔄 Extraindo Mídia..." : "🔴 Gravando Stream...";
    statusEl.style.color = "#3b82f6";
    updateProgress(85, 150);

    chrome.runtime.sendMessage({ action: actionType, url: rawUrl, mode: modeSelected }, (res) => {
      clearInterval(progressInterval);

      if (!res || !res.success || !res.responseOk) {
        statusEl.innerText = "❌ Falha. Verifique a URL ou tente o modo de gravação.";
        statusEl.style.color = "#ef4444";
        return;
      }

      if (res.data && res.data.token) {
        if (progressBar) progressBar.style.width = "100%";
        statusEl.innerText = "✅ Baixando arquivo...";
        statusEl.style.color = "#10b981";
        
        chrome.downloads.download({
          url: res.data.token,
          filename: res.data.file.replace(/^rec_\d+_+/, ''),
          saveAs: shouldAskFolder
        }, () => {
          statusEl.innerText = "✅ Concluído!";
        });
      }
    });
  };

  // Mapear todos os botões de Servidor
  const serverButtons = ['btn-yt', 'btn-ig', 'btn-fb', 'btn-tk', 'btn-gen'];
  serverButtons.forEach(id => {
      const btn = document.getElementById(id);
      if(btn) {
          btn.onclick = (e) => { e.preventDefault(); processDownload("fetchMedia"); };
      }
  });

  // Botão de gravação local
  const btnRecord = document.getElementById("btn-record");
  if(btnRecord) {
      btnRecord.onclick = (e) => { e.preventDefault(); processDownload("recordServerStream"); };
  }
});
