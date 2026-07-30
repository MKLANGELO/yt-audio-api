document.addEventListener("DOMContentLoaded", async () => {
  const statusPanel = document.getElementById("status-panel");
  const statusEl = document.getElementById("status");
  const progressContainer = document.getElementById("progress-container");
  const progressBar = document.getElementById("progress-bar");

  let progressInterval;
  let currentProgress = 0;
  let currentTab = null;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;
    if (tab && tab.url) {
        const url = tab.url;
        if (url.includes("tiktok.com")) document.getElementById("url-tk").value = url;
        else if (url.includes("instagram.com")) document.getElementById("url-ig").value = url;
        else if (url.includes("youtube.com") || url.includes("youtu.be")) document.getElementById("url-yt").value = url;
        else if (url.includes("facebook.com")) document.getElementById("url-fb").value = url;
        else {
            document.getElementById("url-gen").value = url;
            document.getElementById("url-rec").value = url;
        }
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

  // --- DOWNLOAD DIRETO VIA NAVEGADOR (BOTÃO TIKTOK) ---
  const processDirectTikTok = (tabId, fallbackUrl, modeSelected, shouldAskFolder) => {
      statusEl.innerHTML = "🥷 <b>Infiltrando na página (Modo Local)...</b><br><span style='font-size: 13px; color: #a1a1aa;'>Capturando o vídeo direto da memória.</span>";
      updateProgress(50, 50);

      chrome.tabs.sendMessage(tabId, { action: "extractTikTokRaw" }, (response) => {
          clearInterval(progressInterval);
          if (chrome.runtime.lastError || !response || !response.success) {
              // Se a extração local falhar, manda pro servidor (o fallback que sabemos que funciona)
              statusEl.innerHTML = "⚠️ <b>Falha na leitura local.</b><br><span style='font-size: 13px; color: #a1a1aa;'>Redirecionando para o servidor...</span>";
              processServerDownload("fetchMedia", fallbackUrl, modeSelected, shouldAskFolder);
              return;
          }

          if (progressBar) progressBar.style.width = "100%";
          statusEl.innerHTML = "<span style='color: #0be09b;'>✅ MP4 descriptografado! Baixando...</span>";
          
          chrome.downloads.download({
              url: response.link,
              filename: `tiktok_local_${Date.now()}.mp4`,
              saveAs: shouldAskFolder
          }, () => {
              statusEl.innerHTML = "<span style='color: #0be09b;'>✅ Download local concluído!</span>";
          });
      });
  };

  // --- DOWNLOAD VIA SERVIDOR RENDER (OUTRAS REDES E FALLBACK) ---
  const processServerDownload = (actionType, rawUrl, modeSelected, shouldAskFolder) => {
      statusEl.innerHTML = actionType === "fetchMedia" ? "🔄 <b>Processando Mídia no Servidor...</b>" : "🔴 <b>Gravando Stream...</b>";
      updateProgress(85, 150);

      chrome.runtime.sendMessage({ action: actionType, url: rawUrl, mode: modeSelected }, (res) => {
        clearInterval(progressInterval);

        if (!res || !res.success || !res.responseOk) {
          statusEl.innerHTML = `
              <span style="color: #ff4c3a; font-weight: bold;">❌ Falha no servidor.</span>
              <div style="margin-top: 10px; font-size: 13.5px; text-align: left; color: #e4e4e7; line-height: 1.5;">
                  Verifique o link ou tente o botão <b>🔴 Gravar Stream</b>.
              </div>`;
          return;
        }

        if (res.data && res.data.token) {
          if (progressBar) progressBar.style.width = "100%";
          statusEl.innerHTML = "<span style='color: #0be09b;'>✅ Download iniciado!</span>";
          
          chrome.downloads.download({
            url: res.data.token,
            filename: res.data.file.replace(/^rec_\d+_+/, ''),
            saveAs: shouldAskFolder
          }, () => {
            statusEl.innerHTML = "<span style='color: #0be09b;'>✅ Arquivo salvo!</span>";
          });
        }
      });
  };

  const processDownload = async (actionType, inputId) => {
    const urlInput = document.getElementById(inputId);
    const rawUrl = urlInput ? urlInput.value.trim() : "";
    
    statusPanel.style.display = "block";

    if (!rawUrl) { 
        statusEl.innerHTML = "❌ <b>Nenhum link detectado!</b>"; 
        return; 
    }

    const modeSelected = document.querySelector('input[name="mode"]:checked').value;
    const shouldAskFolder = document.getElementById("ask-folder").checked;

    currentProgress = 0;
    if (progressContainer) progressContainer.style.display = "block";
    if (progressBar) progressBar.style.width = "0%";

    // ROTEAMENTO: 
    // Se o usuário clicou em 'Baixar TikTok' (url-tk) E está na aba do TikTok E pediu Vídeo -> Modo Local
    if (inputId === "url-tk" && currentTab && currentTab.url.includes("tiktok.com") && modeSelected === "video") {
        processDirectTikTok(currentTab.id, rawUrl, modeSelected, shouldAskFolder);
    } else {
        // Se for o botão 'Outras Redes' (url-gen) ou qualquer outro -> Manda pro Servidor
        processServerDownload(actionType, rawUrl, modeSelected, shouldAskFolder);
    }
  };

  const buttons = document.querySelectorAll("button:not(#btn-spy)");
  buttons.forEach(btn => {
      btn.onclick = (e) => {
          e.preventDefault();
          const inputId = btn.getAttribute("data-input");
          const actionType = btn.id === "btn-record" ? "recordServerStream" : "fetchMedia";
          processDownload(actionType, inputId);
      };
  });

  const spyBtn = document.getElementById("btn-spy");
  if(spyBtn) {
      spyBtn.onclick = (e) => {
          e.preventDefault();
          statusPanel.style.display = "block";
          statusEl.innerHTML = "🚀 <b>Conectando à API...</b>";
          fetch("https://baixatudo-bvx4.onrender.com/spy-products")
            .then(res => res.json())
            .then(data => {
                if(data.success) statusEl.innerHTML = `✅ <b>Busca concluída!</b>`;
                else statusEl.innerHTML = `❌ <b>Aviso:</b> API Key não configurada.`;
            })
            .catch(err => { statusEl.innerHTML = `❌ <b>Erro na API.</b>`; });
      };
  }
});
