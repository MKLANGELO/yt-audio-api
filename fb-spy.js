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
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(18, 18, 18, 0.9); z-index: 999999; display: flex;
        flex-direction: column; align-items: center; justify-content: center;
        color: #fff; font-family: sans-serif;
    `;
    
    const title = document.createElement('h1');
    title.innerText = "🕵️ Minerador de Produtos Vencedores Ativo";
    title.style.marginBottom = "20px";
    
    const counter = document.createElement('h2');
    counter.innerText = "Anúncios analisados: 0";
    counter.style.color = "#0be09b";
    
    const statusText = document.createElement('p');
    statusText.innerText = "Rolando a página para carregar anúncios antigos...";
    statusText.style.marginTop = "20px";
    
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
                statusText.innerText = "Varredura concluída! Gerando relatório PDF...";
                setTimeout(() => gerarRelatorio(adsData), 2000);
            }
        } else {
            attempts = 0;
            lastHeight = currentHeight;
        }
    }, 1500);
}

function gerarRelatorio(ads) {
    const vencedores = ads.filter(ad => {
        const diffTempo = HOJE.getTime() - ad.dataObjeto.getTime();
        return diffTempo > TRINTA_DIAS_EM_MS;
    });

    vencedores.sort((a, b) => a.dataObjeto - b.dataObjeto);

    let htmlContent = `
        <html>
        <head>
            <title>Relatório de Produtos Vencedores</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
                h1 { color: #1877f2; border-bottom: 2px solid #1877f2; padding-bottom: 10px; }
                .summary { background: #f0f2f5; padding: 15px; border-radius: 8px; margin-bottom: 30px; font-weight: bold; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                th { background-color: #1877f2; color: white; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                a { color: #1877f2; text-decoration: none; font-weight: bold; }
                a:hover { text-decoration: underline; }
                .print-btn { background: #0be09b; border: none; padding: 10px 20px; font-size: 16px; font-weight: bold; cursor: pointer; border-radius: 5px; margin-bottom: 20px; }
                @media print { .print-btn { display: none; } }
            </style>
        </head>
        <body>
            <h1>Relatório Meta Ads: Produtos Vencedores e Escalados</h1>
            <div class="summary">
                Total de Anúncios Analisados: ${ads.length}<br>
                Anúncios Vencedores (Mais de 30 dias ativos): ${vencedores.length}<br>
                Data da Análise: ${HOJE.toLocaleDateString('pt-BR')}
            </div>
            
            <button class="print-btn" onclick="window.print()">🖨️ Salvar como PDF</button>

            <table>
                <thead>
                    <tr>
                        <th>Nº</th>
                        <th>Data de Início</th>
                        <th>ID da Biblioteca</th>
                        <th>Link do Anúncio</th>
                    </tr>
                </thead>
                <tbody>
    `;

    vencedores.forEach((ad, index) => {
        htmlContent += `
            <tr>
                <td>${index + 1}</td>
                <td>${ad.dataTexto}</td>
                <td>${ad.id}</td>
                <td><a href="${ad.link}" target="_blank">Ver Detalhes do Anúncio</a></td>
            </tr>
        `;
    });

    htmlContent += `
                </tbody>
            </table>
        </body>
        </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    document.body.removeChild(document.body.lastChild);
}
