document.addEventListener("DOMContentLoaded", () => {
  const btnDownload = document.getElementById("btn-download");

  if (btnDownload) {
    btnDownload.onclick = async (e) => {
      if (e) e.preventDefault();

      const statusEl = document.getElementById("status");

      if (!navigator.onLine) {
        statusEl.innerText = "Erro: Sem conexão com a internet!";
        statusEl.style.color = "#ff4444";
        return;
      }

      statusEl.innerText = "Processando download...";
      statusEl.style.color = "#aaa";

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const videoUrl = tab && tab.url ? tab.url : "";

        if (!videoUrl) {
          statusEl.innerText = "Abra uma página de vídeo válida!";
          statusEl.style.color = "#ff4444";
          return;
        }

        let safeTitle = tab.title ? tab.title.replace(/[<>:"/\\|?*]+/g, "").trim().substring(0, 80) : "video_baixado";

        chrome.runtime.sendMessage({ action: "fetchMedia", url: videoUrl, mode: "video" }, async (res) => {
          if (!res || !res.success) {
            statusEl.innerText = "Erro de comunicação com a extensão.";
            statusEl.style.color = "#ff4444";
            return;
          }

          const { responseOk, status, data } = res;

          if (!responseOk) {
            const errorMsg = data.detail || data.error || "Erro no servidor.";
            statusEl.innerText = "Erro: " + errorMsg;
            statusEl.style.color = "#ff4444";
            return;
          }

          if (data && data.token) {
            statusEl.innerText = "Download iniciado!";
            statusEl.style.color = "#4BB543";

            // Dispara diretamente o download pelo navegador sem abrir abas extras
            chrome.downloads.download({
              url: data.token,
              filename: `${safeTitle}.mp4`,
              saveAs: false
            }, () => {
              statusEl.innerText = "Download concluído com sucesso!";
              statusEl.style.color = "#4BB543";
            });
          } else {
            statusEl.innerText = "Erro: Link de download não retornado.";
            statusEl.style.color = "#ff4444";
          }
        });

      } catch (err) {
        console.error("Detalhe do erro:", err);
        statusEl.innerText = "Erro inesperado no processo.";
        statusEl.style.color = "#ff4444";
      }
    };
  }
});
