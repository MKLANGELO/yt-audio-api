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

  if (btnDownload) {
    btnDownload.onclick = async (e) => {
      e.preventDefault();
      const videoUrl = urlInput ? urlInput.value.trim() : "";
      if (!videoUrl) { statusEl.innerText = "❌ Insira uma URL!"; return; }

      const modeSelected = document.querySelector('input[name="mode"]:checked').value;
      const shouldAskFolder = document.getElementById("ask-folder").checked;

      currentProgress = 0;
      if (progressContainer) progressContainer.style.display = "block";
      if (progressBar) progressBar.style.width = "0%";

      btnDownload.disabled = true;
      btnDownload.style.opacity = "0.6";
      statusEl.innerText = "Processando no servidor...";

      updateProgress(85, 150);

      chrome.runtime.sendMessage({ action: "fetchMedia", url: videoUrl, mode: modeSelected }, (res) => {
        clearInterval(progressInterval);

        if (!res || !res.success || !res.responseOk) {
          statusEl.innerText = "❌ Falha no servidor. Tente usar o botão vermelho 🔴";
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
      const videoUrl = urlInput ? urlInput.value.trim() : "";
      if (!videoUrl) {
        statusEl.innerText = "❌ Insira uma URL válida!";
        statusEl.style.color = "#ef4444";
        return;
      }

      const modeSelected = document.querySelector('input[name="mode"]:checked').value;
      const shouldAskFolder = document.getElementById("ask-folder").checked;

      currentProgress = 0;
      if (progressContainer) progressContainer.style.display = "block";
      if (progressBar) progressBar.style.width = "0%";

      btnRecord.disabled = true;
      btnRecord.style.opacity = "0.6";
      statusEl.innerText = "🔄 Gravando stream no servidor... Aguarde.";
      statusEl.style.color = "#3b82f6";

      updateProgress(90, 200);

      chrome.runtime.sendMessage({ action: "recordServerStream", url: videoUrl, mode: modeSelected }, (res) => {
        clearInterval(progressInterval);

        if (!res || !res.success || !res.responseOk) {
          statusEl.innerText = "❌ Erro ao gravar stream no servidor.";
          statusEl.style.color = "#ef4444";
          btnRecord.disabled = false;
          btnRecord.style.opacity = "1";
          return;
        }

        const { data } = res;
        if (data && data.token) {
          if (progressBar) progressBar.style.width = "100%";
          statusEl.innerText = "✅ Stream gravado! Baixando arquivo...";
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
          statusEl.innerText = "❌ Erro ao gerar arquivo do stream.";
          statusEl.style.color = "#ef4444";
          btnRecord.disabled = false;
          btnRecord.style.opacity = "1";
        }
      });
    };
  }
});
