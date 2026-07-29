const express = require('express');
const cors = require('cors');
const youtubedl = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs');
const ffmpegPath = require('ffmpeg-static');

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

// Limpeza segura de arquivos com mais de 10 minutos para evitar acúmulo no Render
function cleanOldFiles() {
    try {
        const files = fs.readdirSync(DOWNLOADS_DIR);
        const now = Date.now();
        files.forEach(f => {
            const filePath = path.join(DOWNLOADS_DIR, f);
            const stats = fs.statSync(filePath);
            if (now - stats.mtime.getTime() > 600000) {
                fs.unlinkSync(filePath);
            }
        });
    } catch(e) {}
}

app.post('/', async (req, res) => {
    req.setTimeout(300000); 
    cleanOldFiles();

    const mediaUrl = req.body.url;
    const mode = req.body.mode || 'video';
    const browserCookies = req.body.cookies;

    if (!mediaUrl) return res.status(400).json({ error: "Missing 'url'." });

    let cookieFilePath = null;
    try {
        const targetDomain = new URL(mediaUrl).hostname.replace('www.', '');
        
        if (Array.isArray(browserCookies) && browserCookies.length > 0) {
            cookieFilePath = path.join(DOWNLOADS_DIR, `cookies_${Date.now()}.txt`);
            let netscapeContent = "# Netscape HTTP Cookie File\n\n";
            browserCookies.forEach(c => {
                let d = c.domain.startsWith('.') ? c.domain : `.${c.domain}`;
                netscapeContent += `${d}\tTRUE\t${c.path || '/'}\t${c.secure ? 'TRUE' : 'FALSE'}\t${c.expirationDate ? Math.floor(c.expirationDate) : 2147483647}\t${c.name}\t${c.value}\n`;
            });
            fs.writeFileSync(cookieFilePath, netscapeContent);
        }

        // Padrão exato de salvamento no disco com timestamp e extensão original gerada pelo yt-dlp
        const filePrefix = Date.now();
        const outputTemplate = path.join(DOWNLOADS_DIR, `${filePrefix}_%(title)s.%(ext)s`);
        
        const options = {
            output: outputTemplate,
            noCheckCertificates: true,
            geoBypass: true,
            noPlaylist: true,
            noWarnings: true,
            ffmpegLocation: ffmpegPath,
            socketTimeout: 300,
            retries: 30
        };

        if (cookieFilePath) {
            options.cookies = cookieFilePath;
        }

        if (targetDomain.includes('facebook.com')) {
            options.addHeader = [
                'User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBDV/iPhone14,2;FBMD/iPhone;FBSN/iOS;FBSV/16.5;FBSS/3;FBID/phone;FBLC/pt_BR;FBOP/5]',
                'Accept-Language: pt-BR,pt;q=0.9',
                'Referer: https://www.facebook.com/'
            ];
        }

        if (mode === 'audio') {
            options.extractAudio = true;
            options.audioFormat = 'mp3';
            options.audioQuality = 0;
            options.format = 'bestaudio/best';
        } else {
            options.format = 'best/bestvideo+bestaudio';
            options.preferFreeFormats = true;
        }

        console.log(`Baixando mídia com ID [${filePrefix}]: ${mediaUrl}`);
        await youtubedl(mediaUrl, options);

        if (cookieFilePath && fs.existsSync(cookieFilePath)) fs.unlinkSync(cookieFilePath);

        // Varre a pasta de downloads procurando o arquivo que começa exatamente com este timestamp único
        const files = fs.readdirSync(DOWNLOADS_DIR);
        const generatedFile = files.find(f => f.startsWith(`${filePrefix}_`) && !f.endsWith('.txt') && !f.endsWith('.part'));

        if (!generatedFile) {
            throw new Error("Nenhum arquivo correspondente foi gravado no disco.");
        }

        const downloadToken = `${req.protocol}://${req.get('host')}/download/${encodeURIComponent(generatedFile)}`;
        return res.json({ token: downloadToken, file: generatedFile });

    } catch (err) {
        if (cookieFilePath && fs.existsSync(cookieFilePath)) fs.unlinkSync(cookieFilePath);
        console.error("Erro yt-dlp disco:", err.message);
        return res.status(500).json({ error: "Falha ao gerar o arquivo de mídia.", detail: err.message });
    }
});

// Rota de entrega: Mantém o arquivo no servidor durante o envio e só limpa após o download do usuário finalizar
app.get('/download/:filename', (req, res) => {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = path.join(DOWNLOADS_DIR, filename);
    
    if (fs.existsSync(filePath)) {
        res.download(filePath, filename, (err) => {
            // Garante que o arquivo só será apagado do servidor DEPOIS que o usuário terminar de baixar
            setTimeout(() => {
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log(`Cache limpo com sucesso para o arquivo: ${filename}`);
                    }
                } catch(e){}
            }, 5000); // 5 segundos de folga após o término do stream
        });
    } else {
        res.status(404).json({ error: "Arquivo expirado ou já removido do cache." });
    }
});

app.listen(process.env.PORT || 10000, '0.0.0.0', () => console.log("Servidor sincronizado rodando."));
