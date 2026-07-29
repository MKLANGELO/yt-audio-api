document.addEventListener("DOMContentLoaded", () => {
  const btnDownload = document.getElementById("btn-download");
  const statusEl = document.getElementById("status");
  const progressContainer = document.getElementById("progress-container");
  const progressBar = document.getElementById("progress-bar");
  const progressText = document.getElementById("progress-text");
  const askFolderCheckbox = document.getElementById("ask-folder");

  let progressInterval;
  let currentProgress = 0;

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

      // Proteção extra caso o HTML não carregue as opções
      const modeInput = document.querySelector('input[name="mode"]:checked');
      const modeSelected = modeInput ? modeInput.value : "video";
      const shouldAskFolder = askFolderCheckbox ? askFolderCheckbox.checked : true;

      currentProgress = 0;
      if (progressContainer) progressContainer.style.display = "block";
      if (progressBar) progressBar.style.width = "0%";
      if (progressText) progressText.innerText = "0%";
      
      btnDownload.disabled = true;
      btnDownload.style.opacity = "0.6";

      statusEl.innerText = "Processando mídia no servidor...";
      statusEl.style.color = "#a1a1aa";

      updateProgress(85, 150);

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const videoUrl = tab && tab.url ? tab.url : "";

        if (!videoUrl) {
          clearInterval(progressInterval);
          statusEl.innerText = "❌ Abra uma página de vídeo válida!";
          statusEl.style.color = "#ef4444";
          btnDownload.disabled = false;
          btnDownload.style.opacity = "1";
          return;
        }

        let safeTitle = tab.title ? tab.title.replace(/[<>:"/\\|?*]+/g, "").trim().substring(0, 80) : "midia_baixada";
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
            
            // SISTEMA ANTIGO RESTAURADO: Redireciona caso o login falhe
            if (status === 400 && errorMsg.toLowerCase().includes("login")) {
              let loginUrl = "https://www.youtube.com";
              if (videoUrl.includes("instagram.com")) loginUrl = "https://www.instagram.com";
              if (videoUrl.includes("facebook.com")) loginUrl = "https://www.facebook.com";

              statusEl.innerText = "Sessão expirada! Abrindo tela de login...";
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
            
            statusEl.innerText = shouldAskFolder 
              ? "Escolha onde salvar o arquivo..." 
              : "Iniciando download...";
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
            statusEl.innerText = "❌ Erro ao gerar o link final.";
            statusEl.style.color = "#ef4444";
            btnDownload.disabled = false;
            btnDownload.style.opacity = "1";
          }
        });

      } catch (err) {
        clearInterval(progressInterval);
        console.error("Erro:", err);
        statusEl.innerText = "❌ Erro inesperado.";
        statusEl.style.color = "#ef4444";
        btnDownload.disabled = false;
        btnDownload.style.opacity = "1";
      }
    };
  }
});
