document.addEventListener("DOMContentLoaded", () => {
  const btnDownload = document.getElementById("btn-download");
  const statusEl = document.getElementById("status");
  const progressContainer = document.getElementById("progress-container");
  const progressBar = document.getElementById("progress-bar");

  if (btnDownload) {
    btnDownload.onclick = async (e) => {
      if (e) e.preventDefault();

      if (!navigator.onLine) {
        statusEl.innerText = "Erro: Sem conexão com a internet!";
        statusEl.style.color = "#ff4444";
        return;
      }

      const modeSelected = document.querySelector('input[name="mode"]:checked').value;

      // Exibe e anima a barra de progresso
      progressContainer.style.display = "block";
      progressBar.style.width = "30%";
      statusEl.innerText = "Conectando ao servidor e processando...";
      statusEl.style.color = "#aaa";

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const videoUrl = tab && tab.url ? tab.url : "";

        if (!videoUrl) {
          progressContainer.style.display = "none";
          statusEl.innerText = "Abra uma página de vídeo válida!";
          statusEl.style.color = "#ff4444";
          return;
        }

        let safeTitle = tab.title ? tab.title.replace(/[<>:"/\\|?*]+/g, "").trim().substring(0, 80) : "midia_baixada";
        let extension = modeSelected === "audio" ? "mp3" : "mp4";

        progressBar.style.width = "60%";

        chrome.runtime.sendMessage({ action: "fetchMedia", url: videoUrl, mode: modeSelected }, async (res) => {
          if (!res || !res.success) {
            progressContainer.style.display = "none";
            statusEl.innerText = "Erro de comunicação com a extensão.";
            statusEl.style.color = "#ff4444";
            return;
          }

          const { responseOk, status, data } = res;

          if (!responseOk) {
            progressContainer.style.display = "none";
            const errorMsg = data.detail || data.error || "Erro no servidor.";
            statusEl.innerText = "Erro: " + errorMsg;
            statusEl.style.color = "#ff4444";
            return;
          }

          if (data && data.token) {
            progressBar.style.width = "90%";
            statusEl.innerText = "Iniciando download no computador...";
            statusEl.style.color = "#4BB543";

            chrome.downloads.download({
              url: data.token,
              filename: `${safeTitle}.${extension}`
            }, () => {
              progressBar.style.width = "100%";
              statusEl.innerText = "Download concluído com sucesso!";
              statusEl.style.color = "#4BB543";
            });
          } else {
            progressContainer.style.display = "none";
            statusEl.innerText = "Erro: Token de download não retornado.";
            statusEl.style.color = "#ff4444";
          }
        });

      } catch (err) {
        progressContainer.style.display = "none";
        console.error("Detalhe do erro:", err);
        statusEl.innerText = "Erro inesperado no processo.";
        statusEl.style.color = "#ff4444";
      }
    };
  }
});
