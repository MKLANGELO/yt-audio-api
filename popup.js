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

  const processServerDownload = (actionType, rawUrl, modeSelected, shouldAskFolder) => {
      statusEl.innerHTML = actionType === "fetchMedia" ? "🔄 <b>Processando Mídia no Servidor...</b>" : "🔴 <b>Gravando Stream...</b>";
      updateProgress(85, 150);

      chrome.runtime.sendMessage({ action: actionType, url: rawUrl, mode: modeSelected }, (res) => {
        clearInterval(progressInterval);
        if (!res || !res.success || !res.responseOk) {
          statusEl.innerHTML = `<span style="color: #ff4c3a; font-weight: bold;">❌ Falha no servidor.</span><br><span style='font-size: 13px; color: #a1a1aa;'>Verifique o link ou tente o botão 🔴 Gravar Stream.</span>`;
          return;
        }
        if (res.data && res.data.token) {
          if (progressBar) progressBar.style.width = "100%";
          statusEl.innerHTML = "<span style='color: #0be09b;'>✅ Download iniciado!</span>";
          chrome.downloads.download({
            url: res.data.token, filename: res.data.file.replace(/^rec_\d+_+/, ''), saveAs: shouldAskFolder
          }, () => { statusEl.innerHTML = "<span style='color: #0be09b;'>✅ Arquivo salvo!</span>"; });
        }
      });
  };

  const processDirectSniper = (tabId, fallbackUrl, modeSelected, shouldAskFolder, networkName) => {
      const actionName = networkName === 'TikTok' ? 'extractTikTokRaw' : 'extractYouTubeRaw';
      statusEl.innerHTML = `🥷 <b>Infiltrando no ${networkName}...</b><br><span style='font-size: 13px; color: #a1a1aa;'>Lendo a memória da página local.</span>`;
      updateProgress(50, 50);

      chrome.tabs.sendMessage(tabId, { action: actionName }, (response) => {
          clearInterval(progressInterval);
          if (chrome.runtime.lastError || !response || !response.success) {
              statusEl.innerHTML = `⚠️ <b>Acesso Local Falhou.</b><br><span style='font-size: 13px; color: #a1a1aa;'>Passando o bastão para o Servidor...</span>`;
              processServerDownload("fetchMedia", fallbackUrl, modeSelected, shouldAskFolder);
              return;
          }
          if (progressBar) progressBar.style.width = "100%";
          statusEl.innerHTML = "<span style='color: #0be09b;'>✅ Arquivo original detectado! Baixando...</span>";
          chrome.downloads.download({
              url: response.link, filename: `${networkName.toLowerCase()}_local_${Date.now()}.mp4`, saveAs: shouldAskFolder
          }, () => { statusEl.innerHTML = "<span style='color: #0be09b;'>✅ Download local concluído!</span>"; });
      });
  };

  const processDownload = async (actionType, inputId) => {
    const urlInput = document.getElementById(inputId);
    const rawUrl = urlInput ? urlInput.value.trim() : "";
    statusPanel.style.display = "block";

    if (!rawUrl) { statusEl.innerHTML = "❌ <b>Nenhum link detectado!</b>"; return; }

    const modeSelected = document.querySelector('input[name="mode"]:checked').value;
    const shouldAskFolder = document.getElementById("ask-folder").checked;

    currentProgress = 0;
    if (progressContainer) progressContainer.style.display = "block";
    if (progressBar) progressBar.style.width = "0%";

    if (inputId === "url-tk" && currentTab && currentTab.url.includes("tiktok.com") && modeSelected === "video") {
        processDirectSniper(currentTab.id, rawUrl, modeSelected, shouldAskFolder, "TikTok");
    } else if (inputId === "url-yt" && currentTab && (currentTab.url.includes("youtube.com") || currentTab.url.includes("youtu.be")) && modeSelected === "video") {
        processDirectSniper(currentTab.id, rawUrl, modeSelected, shouldAskFolder, "YouTube");
    } else {
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

  // =========================================================
  // NOVA AÇÃO: BUSCA DE OFERTAS (FACEBOOK ADS LIBRARY NATIVO)
  // =========================================================
  const spyBtn = document.getElementById("btn-spy");
  if(spyBtn) {
      spyBtn.onclick = (e) => {
          e.preventDefault();
          const nicheInput = document.getElementById("niche-input").value.trim();
          statusPanel.style.display = "block";
          
          if (!nicheInput) {
              statusEl.innerHTML = `❌ <b>Aviso:</b> Por favor, preencha o nicho ou categoria no campo acima.`;
              return;
          }

          statusEl.innerHTML = "🚀 <b>Abrindo Biblioteca de Anúncios...</b>";
          
          // Constrói a URL profunda automatizada
          // active_status=active -> Apenas anúncios rodando
          // ad_type=all -> Todos os anúncios
          // country=BR -> Direcionado para a nossa região
          const fbAdLibraryUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(nicheInput)}&search_type=keyword_unordered&media_type=all`;
          
          chrome.tabs.create({ url: fbAdLibraryUrl });
          statusEl.innerHTML = `✅ <b>Busca em andamento!</b><br><span style='font-size: 13px; color: #0be09b;'>Uma nova aba foi aberta com as ofertas de "${nicheInput}".</span>`;
      };
  }
});
