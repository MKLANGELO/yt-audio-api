const express = require('express');
const cors = require('cors');
const youtubedl = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs');

const app = express();

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

app.post('/', async (req, res) => {
    const mediaUrl = req.body.url;
    const mode = req.body.mode || 'video';
    const browserCookies = req.body.cookies;

    if (!mediaUrl) return res.status(400).json({ error: "Missing 'url' parameter." });

    let cookieFilePath = null;
    try {
        const targetDomain = new URL(mediaUrl).hostname.replace('www.', '');
        
        // RECRIANDO O SISTEMA DO PYTHON: Gera um arquivo Netscape temporário
        if (browserCookies && browserCookies.trim() !== "") {
            cookieFilePath = path.join(DOWNLOADS_DIR, `cookies_${Date.now()}.txt`);
            let netscapeCookieContent = "# Netscape HTTP Cookie File\n";
            browserCookies.split(';').forEach(cookie => {
                const parts = cookie.trim().split('=');
                if (parts.length >= 2) {
                    const name = parts.shift();
                    const value = parts.join('=');
                    netscapeCookieContent += `.${targetDomain}\tTRUE\t/\tFALSE\t2147483647\t${name}\t${value}\n`;
                }
            });
            fs.writeFileSync(cookieFilePath, netscapeCookieContent);
        }

        const outputTemplate = path.join(DOWNLOADS_DIR, `${Date.now()}_%(title)s.%(ext)s`);
        
        // CONFIGURAÇÕES IDÊNTICAS AO SEU SISTEMA PYTHON ANTIGO
        const options = {
            output: outputTemplate,
            noCheckCertificates: true, 
            geoBypass: true,           
            noPlaylist: true,          
            noWarnings: true,
            preferFreeFormats: true,
            format: 'best[ext=mp4]/best'
        };

        // CORREÇÃO CRÍTICA DO YOUTUBE E INJEÇÃO DO CACHE DE COOKIES
        if (cookieFilePath) {
            options.cookies = cookieFilePath;
            if (targetDomain.includes('youtube')) {
                // Força o YouTube a usar o cliente Web padrão, impedindo o bloqueio de cookies randômicos
                options.extractorArgs = 'youtube:player_client=web'; 
            } else {
                options.addHeader = [
                    'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
                    `Referer: https://www.${targetDomain}/`
                ];
            }
        }

        if (mode === 'audio') {
            options.extractAudio = true;
            options.audioFormat = 'mp3';
            delete options.format;
        }

        console.log(`Processando [${targetDomain}] com cache nativo: ${mediaUrl}`);

        await youtubedl(mediaUrl, options);

        // Limpeza imediata do arquivo de cache de segurança
        if (cookieFilePath && fs.existsSync(cookieFilePath)) {
            try { fs.unlinkSync(cookieFilePath); } catch(e){}
        }

        const files = fs.readdirSync(DOWNLOADS_DIR);
        const recentFile = files
            .filter(f => !f.endsWith('.txt'))
            .map(f => ({ name: f, time: fs.statSync(path.join(DOWNLOADS_DIR, f)).mtime.getTime() }))
            .sort((a, b) => b.time - a.time)[0];

        if (!recentFile) throw new Error("Arquivo não salvo no disco.");

        const downloadToken = `${req.protocol}://${req.get('host')}/download/${recentFile.name}`;
        return res.json({ token: downloadToken, file: recentFile.name });

    } catch (err) {
        if (cookieFilePath && fs.existsSync(cookieFilePath)) {
            try { fs.unlinkSync(cookieFilePath); } catch(e){}
        }
        console.error("Erro interno:", err.message);
        return res.status(500).json({ error: "Falha ao extrair a mídia.", detail: err.message });
    }
});

app.get('/download/:filename', (req, res) => {
    const filePath = path.join(DOWNLOADS_DIR, req.params.filename);
    if (fs.existsSync(filePath)) {
        res.download(filePath, req.params.filename, (err) => {
            if (!err) setTimeout(() => { try { fs.unlinkSync(filePath); } catch(e){} }, 10000);
        });
    } else {
        res.status(404).json({ error: "Arquivo expirado." });
    }
});

app.use((err, req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.status(500).json({ error: "Erro interno no servidor Node.", detail: err.message });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor rodando na porta ${PORT}`));
