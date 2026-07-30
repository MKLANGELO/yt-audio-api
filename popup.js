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

  // --- DOWNLOAD VIA SERVIDOR RENDER (FALLBACK GERAL) ---
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

  // --- DOWNLOAD DIRETO VIA NAVEGADOR (TIKTOK E YOUTUBE) ---
  const processDirectSniper = (tabId, fallbackUrl, modeSelected, shouldAskFolder, networkName) => {
      const actionName = networkName === 'TikTok' ? 'extractTikTokRaw' : 'extractYouTubeRaw';
      
      statusEl.innerHTML = `🥷 <b>Infiltrando no ${networkName} (Modo Local)...</b><br><span style='font-size: 13px; color: #a1a1aa;'>Lendo a memória da página para contornar bloqueios de servidor.</span>`;
      updateProgress(50, 50);

      chrome.tabs.sendMessage(tabId, { action: actionName }, (response) => {
          clearInterval(progressInterval);
          // Se a extração falhar (ex: vídeo está criptografado ou não estamos na página certa)
          if (chrome.runtime.lastError || !response || !response.success) {
              statusEl.innerHTML = `⚠️ <b>Acesso Local Falhou.</b><br><span style='font-size: 13px; color: #a1a1aa;'>Vídeo blindado ou fragmentado. Passando o bastão para o Servidor...</span>`;
              processServerDownload("fetchMedia", fallbackUrl, modeSelected, shouldAskFolder);
              return;
          }

          if (progressBar) progressBar.style.width = "100%";
          statusEl.innerHTML = "<span style='color: #0be09b;'>✅ Arquivo original detectado! Baixando...</span>";
          
          chrome.downloads.download({
              url: response.link,
              filename: `${networkName.toLowerCase()}_local_${Date.now()}.mp4`,
              saveAs: shouldAskFolder
          }, () => {
              statusEl.innerHTML = "<span style='color: #0be09b;'>✅ Download local concluído!</span>";
          });
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

    // ROTEAMENTO INTELIGENTE:
    // Se for TikTok + Video + Aba Aberta
    if (inputId === "url-tk" && currentTab && currentTab.url.includes("tiktok.com") && modeSelected === "video") {
        processDirectSniper(currentTab.id, rawUrl, modeSelected, shouldAskFolder, "TikTok");
    } 
    // Se for YouTube + Video + Aba Aberta
    else if (inputId === "url-yt" && currentTab && (currentTab.url.includes("youtube.com") || currentTab.url.includes("youtu.be")) && modeSelected === "video") {
        processDirectSniper(currentTab.id, rawUrl, modeSelected, shouldAskFolder, "YouTube");
    } 
    // Outros casos (Facebook, Instagram, Colou link de fora, etc)
    else {
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
