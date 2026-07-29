document.addEventListener("DOMContentLoaded", () => {
  const btnDownload = document.getElementById("btn-download");
  
  if (btnDownload) {
    btnDownload.onclick = async (e) => {
      // Impede qualquer comportamento padrão de formulário ou recarregamento de página
      if (e) e.preventDefault();

      const statusEl = document.getElementById("status");

      if (!navigator.onLine) {
        statusEl.innerText = "Erro: Sem conexão com a internet!";
        statusEl.style.color = "#ff4444";
        return;
      }

      statusEl.innerText = "Verificando sessão e mídia...";
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

            if (status === 400 && (errorMsg.includes("Sessão expirada") || errorMsg.includes("bot") || errorMsg.includes("login"))) {
              let loginUrl = "https://www.youtube.com";
              if (videoUrl.includes("instagram.com")) loginUrl = "https://www.instagram.com";
              if (videoUrl.includes("facebook.com")) loginUrl = "https://www.facebook.com";
              if (videoUrl.includes("xvideos.com")) loginUrl = "https://www.xvideos.com";

              statusEl.innerText = "Sessão expirada! Faça login na aba aberta...";
              statusEl.style.color = "#ffaa00";

              chrome.tabs.create({ url: loginUrl });
              return;
            }

            statusEl.innerText = "Erro: " + errorMsg;
            statusEl.style.color = "#ff4444";
            return;
          }

          if (data && data.token) {
            statusEl.innerText = "Sessão autorizada! Iniciando download...";
            statusEl.style.color = "#4BB543";

            const cloudApiUrl = "https://baixatudo-bvx4.onrender.com";
            const downloadUrl = `${cloudApiUrl}/download?token=${data.token}`;

            chrome.downloads.download({
              url: downloadUrl,
              filename: `${safeTitle}.mp4`
            }, () => {
              statusEl.innerText = "Download concluído com sucesso!";
              statusEl.style.color = "#4BB543";
            });
          } else {
            statusEl.innerText = "Erro: Token de download não retornado.";
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
