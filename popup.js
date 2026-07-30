document.addEventListener("DOMContentLoaded", async () => {
  const statusPanel = document.getElementById("status-panel");
  const statusEl = document.getElementById("status");
  const progressContainer = document.getElementById("progress-container");
  const progressBar = document.getElementById("progress-bar");

  let progressInterval;
  let currentProgress = 0;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
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

  const processDownload = async (actionType, inputId) => {
    const urlInput = document.getElementById(inputId);
    const rawUrl = urlInput ? urlInput.value.trim() : "";
    
    statusPanel.style.display = "block"; // Exibe o painel

    if (!rawUrl) { 
        statusEl.innerHTML = "❌ <b>Nenhum link detectado!</b><br><br><span style='font-size: 13px; color: #a1a1aa;'>Copie o link do vídeo desejado e cole no campo acima antes de clicar.</span>"; 
        return; 
    }

    const modeSelected = document.querySelector('input[name="mode"]:checked').value;
    const shouldAskFolder = document.getElementById("ask-folder").checked;

    currentProgress = 0;
    if (progressContainer) progressContainer.style.display = "block";
    if (progressBar) progressBar.style.width = "0%";

    statusEl.innerHTML = actionType === "fetchMedia" ? "🔄 <b>Processando Mídia...</b>" : "🔴 <b>Gravando Stream...</b>";
    
    updateProgress(85, 150);

    chrome.runtime.sendMessage({ action: actionType, url: rawUrl, mode: modeSelected }, (res) => {
      clearInterval(progressInterval);

      if (!res || !res.success || !res.responseOk) {
        // MENSAGEM DE ERRO APRIMORADA E MAIOR
        statusEl.innerHTML = `
            <span style="color: #ff4c3a; font-weight: bold;">❌ Falha na captura do vídeo.</span>
            <div style="margin-top: 10px; font-size: 13.5px; text-align: left; color: #e4e4e7; line-height: 1.5;">
                <b>O que fazer agora?</b><br>
                1. Certifique-se de que o link inserido é válido.<br>
                2. <b>Se o botão direto falhou</b>, copie e cole o link manualmente.<br>
                3. Em sites com proteção rigorosa, tente o botão <b>🔴 Gravar Stream</b>.
            </div>`;
        return;
      }

      if (res.data && res.data.token) {
        if (progressBar) progressBar.style.width = "100%";
        statusEl.innerHTML = "<span style='color: #0be09b;'>✅ Download iniciado com sucesso!</span>";
        
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

  const buttons = document.querySelectorAll("button:not(#btn-spy)");
  buttons.forEach(btn => {
      btn.onclick = (e) => {
          e.preventDefault();
          const inputId = btn.getAttribute("data-input");
          const actionType = btn.id === "btn-record" ? "recordServerStream" : "fetchMedia";
          processDownload(actionType, inputId);
      };
  });

  // NOVO: Ação do Botão Ad Spy
  const spyBtn = document.getElementById("btn-spy");
  if(spyBtn) {
      spyBtn.onclick = (e) => {
          e.preventDefault();
          statusPanel.style.display = "block";
          statusEl.innerHTML = "🚀 <b>Conectando à API de Produtos...</b><br><span style='font-size: 12px; color: #a1a1aa;'>Buscando anúncios vencedores nas redes.</span>";
          
          fetch("https://baixatudo-bvx4.onrender.com/spy-products")
            .then(res => res.json())
            .then(data => {
                if(data.success) {
                    statusEl.innerHTML = `✅ <b>Busca concluída!</b><br><span style='font-size: 12px; color: #0be09b;'>Verifique a resposta da OutlierKit no painel da API.</span>`;
                    // Aqui você pode fazer o Chrome abrir uma nova aba com os resultados:
                    // chrome.tabs.create({ url: data.dashboardUrl });
                } else {
                    statusEl.innerHTML = `❌ <b>Aviso:</b> API Key da OutlierKit não configurada no servidor.`;
                }
            })
            .catch(err => {
                statusEl.innerHTML = `❌ <b>Erro ao acessar o motor de anúncios.</b>`;
            });
      };
  }
});
