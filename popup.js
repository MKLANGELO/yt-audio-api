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

      const modeInput = document.querySelector('input[name="mode"]:checked');
      const modeSelected = modeInput ? modeInput.value : "video";
      const shouldAskFolder = askFolderCheckbox ? askFolderCheckbox.checked : true;

      currentProgress = 0;
      if (progressContainer) progressContainer.style.display = "block";
      if (progressBar) progressBar.style.width = "0%";
      if (progressText) progressText.innerText = "0%";
      
      btnDownload.disabled = true;
      btnDownload.style.opacity = "0.6";

      statusEl.innerText = "Rastreando player ativo...";
      statusEl.style.color = "#a1a1aa";

      updateProgress(85, 150);

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        chrome.tabs.sendMessage(tab.id, { action: "getPlayingMedia" }, (response) => {
            
            let videoUrl = (response && response.url) ? response.url : (tab ? tab.url : "");

            // A MÁGICA DE PREVENÇÃO DE ERROS ACONTECE AQUI
            // Se a URL final for a página inicial, nós travamos a operação e ensinamos o usuário.
            if (!videoUrl || videoUrl === "https://www.facebook.com/" || videoUrl === "https://www.instagram.com/") {
              clearInterval(progressInterval);
              statusEl.innerText = "⚠️ Clique para abrir o vídeo em tela cheia antes de baixar!";
              statusEl.style.color = "#FF8C00"; // Laranja de aviso
              btnDownload.disabled = false;
              btnDownload.style.opacity = "1";
              return;
            }

            statusEl.innerText = "Enviando pro servidor (pode levar alguns minutos)...";

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
                statusEl.innerText = "❌ Erro ao gerar o link final.";
                statusEl.style.color = "#ef4444";
                btnDownload.disabled = false;
                btnDownload.style.opacity = "1";
              }
            });
        });

      } catch (err) {
        clearInterval(progressInterval);
        console.error("Erro:", err);
        statusEl.innerText = "❌ Erro inesperado. Recarregue a página.";
        statusEl.style.color = "#ef4444";
        btnDownload.disabled = false;
        btnDownload.style.opacity = "1";
      }
    };
  }
});
