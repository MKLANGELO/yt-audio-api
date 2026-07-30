if (window.location.href.includes('auto_spy=true')) {
    setTimeout(initAdSpy, 5000);
}

const MESES = {
    "jan": 0, "fev": 1, "mar": 2, "abr": 3, "mai": 4, "jun": 5,
    "jul": 6, "ago": 7, "set": 8, "out": 9, "nov": 10, "dez": 11
};

const HOJE = new Date(2026, 6, 30);
const TRINTA_DIAS_EM_MS = 30 * 24 * 60 * 60 * 1000;

function parseDataFacebook(textoData) {
    try {
        const regex = /(\d{1,2})\s+de\s+([a-zç]+)(?:\s+de\s+(\d{4}))?/i;
        const match = textoData.match(regex);
        if (match) {
            const dia = parseInt(match[1]);
            const mesStr = match[2].toLowerCase().substring(0, 3);
            const mes = MESES[mesStr];
            const ano = match[3] ? parseInt(match[3]) : HOJE.getFullYear();
            return new Date(ano, mes, dia);
        }
    } catch(e) {}
    return new Date();
}

async function initAdSpy() {
    const overlay = document.createElement('div');
    overlay.id = "spy-loading-overlay";
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: #121212; z-index: 999999; display: flex;
        flex-direction: column; align-items: center; justify-content: center;
        color: #fff; font-family: sans-serif;
    `;
    
    const title = document.createElement('h1');
    title.innerText = "🕵️ Minerador de Produtos Vencedores Ativo";
    title.style.marginBottom = "20px";
    title.style.color = "#25f4ee";
    
    const counter = document.createElement('h2');
    counter.innerText = "Anúncios analisados: 0";
    counter.style.color = "#0be09b";
    
    const statusText = document.createElement('p');
    statusText.innerText = "Varrendo a Biblioteca de Anúncios e coletando dados...";
    statusText.style.marginTop = "20px";
    statusText.style.color = "#a1a1aa";
    
    overlay.appendChild(title);
    overlay.appendChild(counter);
    overlay.appendChild(statusText);
    document.body.appendChild(overlay);

    let lastHeight = 0;
    let attempts = 0;
    let adsData = [];
    let adsProcessados = new Set();

    const scrollInterval = setInterval(() => {
        window.scrollTo(0, document.body.scrollHeight);
        
        const adElements = Array.from(document.querySelectorAll('div')).filter(div => 
            div.textContent && div.textContent.includes('Identificação da biblioteca:') && div.textContent.includes('Veiculação iniciada')
        );

        adElements.forEach(el => {
            const textContent = el.textContent;
            const idMatch = textContent.match(/Identificação da biblioteca:\s*(\d+)/);
            if (!idMatch) return;
            const adId = idMatch[1];
            
            if (adsProcessados.has(adId)) return;
            adsProcessados.add(adId);

            const dataMatch = textContent.match(/Veiculação iniciada em(.*?)(?=\s*Plataformas|$)/);
            let dataInicioStr = dataMatch ? dataMatch[1].trim() : "";
            const dataInicioObjeto = parseDataFacebook(dataInicioStr);

            const linkDetalhes = `https://www.facebook.com/ads/library/?id=${adId}`;

            adsData.push({
                id: adId,
                dataTexto: dataInicioStr,
                dataObjeto: dataInicioObjeto,
                link: linkDetalhes
            });
        });

        counter.innerText = `Anúncios analisados: ${adsData.length}`;

        let currentHeight = document.body.scrollHeight;
        if (currentHeight === lastHeight) {
            attempts++;
            if (attempts >= 5 || adsData.length > 500) {
                clearInterval(scrollInterval);
                statusText.innerText = "Varredura concluída! Renderizando Dashboard exclusivo...";
                setTimeout(() => montarInterfaceClonada(adsData), 2000);
            }
        } else {
            attempts = 0;
            lastHeight = currentHeight;
        }
    }, 1500);
}

function montarInterfaceClonada(ads) {
    const vencedores = ads.filter(ad => {
        const diffTempo = HOJE.getTime() - ad.dataObjeto.getTime();
        return diffTempo > TRINTA_DIAS_EM_MS;
    });

    vencedores.sort((a, b) => a.dataObjeto - b.dataObjeto);

    let htmlCards = '';
    vencedores.forEach((ad, index) => {
        htmlCards += `
            <div style="background: #252525; border: 1px solid #383838; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 10px;">
                <div style="font-size: 13px; color: #25f4ee; font-weight: bold;">Anúncio Vencedor #${index + 1}</div>
                <div style="font-size: 14px; color: #e4e4e7;"><b>Início:</b> ${ad.dataTexto}</div>
                <div style="font-size: 12px; color: #a1a1aa;"><b>ID:</b> ${ad.id}</div>
                <a href="${ad.link}" target="_blank" style="background: #1877f2; color: #fff; text-align: center; padding: 10px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 13px; margin-top: auto;">🔍 Ver Detalhes do Anúncio</a>
            </div>
        `;
    });

    // Substitui todo o conteúdo da página do Facebook pelo nosso Dashboard limpo e profissional
    document.open();
    document.write(`
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Dashboard de Ofertas Vencedoras - Meta Ads</title>
            <style>
                body { background: #121212; color: #fff; font-family: system-ui, sans-serif; margin: 0; padding: 30px; }
                @media print { .no-print { display: none !important; } }
            </style>
        </head>
        <body>
            <div style="max-width: 1200px; margin: 0 auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #25f4ee; padding-bottom: 15px; margin-bottom: 25px;">
                    <div>
                        <h2 style="margin: 0; font-size: 24px; background: linear-gradient(131.17deg, #fe2c55, #25f4ee); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Dashboard de Ofertas Vencedoras</h2>
                        <p style="margin: 5px 0 0 0; color: #a1a1aa; font-size: 14px;">Anúncios validados com mais de 30 dias ativos no mercado.</p>
                    </div>
                    <div class="no-print" style="display: flex; gap: 12px;">
                        <button onclick="window.print()" style="background: #0be09b; color: #000; border: none; padding: 12px 20px; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 14px;">🖨️ Imprimir / Salvar Relatório PDF</button>
                    </div>
                </div>

                <div style="background: #1c1c1c; padding: 15px; border-radius: 8px; margin-bottom: 25px; display: flex; justify-content: space-around; font-size: 14px;">
                    <div>📊 Total Varridos: <b>${ads.length}</b></div>
                    <div>🔥 Produtos Vencedores Filtrados: <b style="color: #0be09b;">${vencedores.length}</b></div>
                    <div>📅 Critério: <b>> 30 Dias Ativos</b></div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
                    ${htmlCards}
                </div>
            </div>
        </body>
        </html>
    `);
    document.close();
}
