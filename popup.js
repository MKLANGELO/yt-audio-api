document.addEventListener("DOMContentLoaded", async () => {
  const btnDownload = document.getElementById("btn-download");
  const btnRecord = document.getElementById("btn-record");
  const statusEl = document.getElementById("status");
  const urlInput = document.getElementById("media-url");
  const progressContainer = document.getElementById("progress-container");
  const progressBar = document.getElementById("progress-bar");

  let progressInterval;
  let currentProgress = 0;

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

  // Função auxiliar para aplicar truques do YouTube se necessário
  function handleYoutubeShortcut(url) {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      // Exemplo aplicando o truque do 'ss' ou abrindo nova aba inteligente se o servidor falhar
      return url;
    }
    return url;
  }

  if (btnDownload) {
    btnDownload.onclick = async (e) => {
      e.preventDefault();
      const rawUrl = urlInput ? urlInput.value.trim() : "";
      if (!rawUrl) { statusEl.innerText = "❌ Insira uma URL!"; return; }

      const videoUrl = handleYoutubeShortcut(rawUrl);
      const modeSelected = document.querySelector('input[name="mode"]:checked').value;
      const shouldAskFolder = document.getElementById("ask-folder").checked;

      currentProgress = 0;
      if (progressContainer) progressContainer.style.display = "block";
      if (progressBar) progressBar.style.width = "0%";

      btnDownload.disabled = true;
      btnDownload.style.opacity = "0.6";
      statusEl.innerText = "Processando vídeo...";

      updateProgress(85, 150);

      chrome.runtime.sendMessage({ action: "fetchMedia", url: videoUrl, mode: modeSelected }, (res) => {
        clearInterval(progressInterval);

        if (!res || !res.success || !res.responseOk) {
          statusEl.innerText = "❌ Falha. Use o truque do 'ss' ou 'pp' no YouTube!";
          btnDownload.disabled = false;
          btnDownload.style.opacity = "1";
          return;
        }

        if (res.data && res.data.token) {
          if (progressBar) progressBar.style.width = "100%";
          statusEl.innerText = "✅ Baixando arquivo...";
          chrome.downloads.download({
            url: res.data.token,
            filename: res.data.file,
            saveAs: shouldAskFolder
          }, () => {
            statusEl.innerText = "✅ Concluído!";
            btnDownload.disabled = false;
            btnDownload.style.opacity = "1";
          });
        }
      });
    };
  }

  if (btnRecord) {
    btnRecord.onclick = async (e) => {
      e.preventDefault();
      const rawUrl = urlInput ? urlInput.value.trim() : "";
      if (!rawUrl) {
        statusEl.innerText = "❌ Insira uma URL válida!";
        statusEl.style.color = "#ef4444";
        return;
      }

      const videoUrl = handleYoutubeShortcut(rawUrl);
      const modeSelected = document.querySelector('input[name="mode"]:checked').value;
      const shouldAskFolder = document.getElementById("ask-folder").checked;

      currentProgress = 0;
      if (progressContainer) progressContainer.style.display = "block";
      if (progressBar) progressBar.style.width = "0%";

      btnRecord.disabled = true;
      btnRecord.style.opacity = "0.6";
      statusEl.innerText = "🔄 Processando stream do YouTube...";
      statusEl.style.color = "#3b82f6";

      updateProgress(90, 200);

      chrome.runtime.sendMessage({ action: "recordServerStream", url: videoUrl, mode: modeSelected }, (res) => {
        clearInterval(progressInterval);

        if (!res || !res.success || !res.responseOk) {
          statusEl.innerText = "❌ Erro no stream. Tente adicionar 'ss' ou 'pp' na URL.";
          statusEl.style.color = "#ef4444";
          btnRecord.disabled = false;
          btnRecord.style.opacity = "1";
          return;
        }

        const { data } = res;
        if (data && data.token) {
          if (progressBar) progressBar.style.width = "100%";
          statusEl.innerText = "✅ Mídia gerada! Baixando...";
          statusEl.style.color = "#10b981";

          chrome.downloads.download({
            url: data.token,
            filename: data.file.replace(/^rec_\d+_+/, ''),
            saveAs: shouldAskFolder
          }, () => {
            statusEl.innerText = "✅ Concluído e cache limpo!";
            btnRecord.disabled = false;
            btnRecord.style.opacity = "1";
          });
        } else {
          statusEl.innerText = "❌ Erro ao gerar arquivo.";
          statusEl.style.color = "#ef4444";
          btnRecord.disabled = false;
          btnRecord.style.opacity = "1";
        }
      });
    };
  }
});
