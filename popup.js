document.addEventListener("DOMContentLoaded", () => {
  const btnDownload = document.getElementById("btn-download");
  const statusEl = document.getElementById("status");
  const progressContainer = document.getElementById("progress-container");
  const progressBar = document.getElementById("progress-bar");
  const progressText = document.getElementById("progress-text");
  const askFolderCheckbox = document.getElementById("ask-folder");

  let progressInterval;
  let currentProgress = 0;

  // Função para simular o progresso em porcentagem
  function updateProgress(targetPercentage, speedMs) {
    clearInterval(progressInterval);
    progressInterval = setInterval(() => {
      if (currentProgress < targetPercentage) {
        currentProgress++;
        progressBar.style.width = currentProgress + "%";
        progressText.innerText = currentProgress + "%";
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

      const modeSelected = document.querySelector('input[name="mode"]:checked').value;
      const shouldAskFolder = askFolderCheckbox.checked;

      // Reseta e exibe a barra
      currentProgress = 0;
      progressContainer.style.display = "block";
      progressBar.style.width = "0%";
      progressText.innerText = "0%";
      
      btnDownload.disabled = true;
      btnDownload.style.opacity = "0.6";

      statusEl.innerText = "Processando mídia no servidor...";
      statusEl.style.color = "#a1a1aa";

      // Inicia a animação até 85% enquanto aguarda o servidor processar
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
            statusEl.innerText = "❌ Erro: " + errorMsg;
            statusEl.style.color = "#ef4444";
            btnDownload.disabled = false;
            btnDownload.style.opacity = "1";
            return;
          }

          if (data && data.token) {
            // Acelera de 85% para 100%
            updateProgress(100, 20);
            
            statusEl.innerText = shouldAskFolder 
              ? "Escolha onde salvar o arquivo..." 
              : "Iniciando download...";
            statusEl.style.color = "#10b981";

            // Dispara o download nativo do navegador
            chrome.downloads.download({
              url: data.token,
              filename: `${safeTitle}.${extension}`,
              saveAs: shouldAskFolder // Abre a caixa de selecionar pasta se marcado
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
