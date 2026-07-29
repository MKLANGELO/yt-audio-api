document.addEventListener("DOMContentLoaded", async () => {
  const btnDownload = document.getElementById("btn-download");
  const statusEl = document.getElementById("status");
  const urlInput = document.getElementById("media-url");
  const progressContainer = document.getElementById("progress-container");
  const progressBar = document.getElementById("progress-bar");
  const progressText = document.getElementById("progress-text");
  const askFolderCheckbox = document.getElementById("ask-folder");

  let progressInterval;
  let currentProgress = 0;

  // Preenche automaticamente com a URL atual se o input existir
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && urlInput) {
      urlInput.value = tab.url;
    }
  } catch (err) {
    console.error("Erro ao capturar aba:", err);
  }

  function updateProgress(targetPercentage, speedMs) {
    clearInterval(progressInterval);
    progressInterval = setInterval(() => {
      if (currentProgress < targetPercentage) {
        currentProgress++;
        if (progressBar) progressBar.style.width = currentProgress + "%";
        if (progressText) progressText.innerText = currentProgress + "%";
      } else {
        clearInterval(progressInterval);
      }
    }, speedMs);
  }

  if (btnDownload) {
    btnDownload.onclick = async (e) => {
      if (e) e.preventDefault();

      if (!navigator.onLine) {
        statusEl.innerText = "❌ Sem conexão com a internet!";
        statusEl.style.color = "#ef4444";
        return;
      }

      const videoUrl = urlInput ? urlInput.value.trim() : "";
      if (!videoUrl) {
        statusEl.innerText = "❌ Insira ou cole uma URL válida!";
        statusEl.style.color = "#ef4444";
        return;
      }

      const modeInput = document.querySelector('input[name="mode"]:checked');
      const modeSelected = modeInput ? modeInput.value : "video";
      const shouldAskFolder = askFolderCheckbox ? askFolderCheckbox.checked : true;

      currentProgress = 0;
      if (progressContainer) progressContainer.style.display = "block";
      if (progressBar) progressBar.style.width = "0%";
      if (progressText) progressText.innerText = "0%";
      
      btnDownload.disabled = true;
      btnDownload.style.opacity = "0.6";

      statusEl.innerText = "Processando Story no servidor...";
      statusEl.style.color = "#a1a1aa";

      updateProgress(85, 150);

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        let safeTitle = tab && tab.title ? tab.title.replace(/[<>:"/\\|?*]+/g, "").trim().substring(0, 80) : "story_baixado";
        let extension = modeSelected === "audio" ? "mp3" : "mp4";

        chrome.runtime.sendMessage({ action: "fetchMedia", url: videoUrl, mode: modeSelected }, async (res) => {
          clearInterval(progressInterval);

          if (!res || !res.success) {
            statusEl.innerText = "❌ Erro de comunicação com o servidor.";
            statusEl.style.color = "#ef4444";
            btnDownload.disabled = false;
            btnDownload.style.opacity = "1";
            return;
          }

          const { responseOk, status, data } = res;

          if (!responseOk) {
            const errorMsg = data.detail || data.error || "Erro no servidor.";
            
            if (status === 400 && errorMsg.toLowerCase().includes("login")) {
              let loginUrl = "https://www.facebook.com";
              if (videoUrl.includes("instagram.com")) loginUrl = "https://www.instagram.com";

              statusEl.innerText = "Sessão expirada para Stories! Abrindo login...";
              statusEl.style.color = "#ffaa00";
              chrome.tabs.create({ url: loginUrl });
              btnDownload.disabled = false;
              btnDownload.style.opacity = "1";
              return;
            }

            statusEl.innerText = "❌ Erro: " + errorMsg;
            statusEl.style.color = "#ef4444";
            btnDownload.disabled = false;
            btnDownload.style.opacity = "1";
            return;
          }

          if (data && data.token) {
            updateProgress(100, 20);
            statusEl.innerText = shouldAskFolder ? "Escolha onde salvar o arquivo..." : "Iniciando download...";
            statusEl.style.color = "#10b981";

            chrome.downloads.download({
              url: data.token,
              filename: `${safeTitle}.${extension}`,
              saveAs: shouldAskFolder
            }, () => {
              statusEl.innerText = "✅ Concluído!";
              btnDownload.disabled = false;
              btnDownload.style.opacity = "1";
            });
          } else {
            statusEl.innerText = "❌ Erro ao gerar o link final do Story.";
            statusEl.style.color = "#ef4444";
            btnDownload.disabled = false;
            btnDownload.style.opacity = "1";
          }
        });

      } catch (err) {
        clearInterval(progressInterval);
        statusEl.innerText = "❌ Erro inesperado.";
        statusEl.style.color = "#ef4444";
        btnDownload.disabled = false;
        btnDownload.style.opacity = "1";
      }
    };
  }
});
