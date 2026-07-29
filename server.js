const express = require('express');
const cors = require('cors');
const youtubedl = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'X-Browser-Cookies']
}));

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Browser-Cookies");
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.use(express.json());

const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

app.get('/', async (req, res) => {
    const mediaUrl = req.query.url;
    const mode = req.query.mode || 'video';
    const browserCookies = req.headers['x-browser-cookies'];

    if (!mediaUrl) return res.status(400).json({ error: "Missing 'url' parameter." });

    let cookieFilePath = null;
    try {
        const targetDomain = new URL(mediaUrl).hostname.replace('www.', '');
        
        // Converte o cache de cookies recebido para o formato estrito Netscape
        if (browserCookies) {
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
        
        const options = {
            output: outputTemplate,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            format: 'best[ext=mp4]/best',
            addHeader: ['User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36']
        };

        if (cookieFilePath) options.cookies = cookieFilePath;

        if (mode === 'audio') {
            options.extractAudio = true;
            options.audioFormat = 'mp3';
            delete options.format;
        }

        console.log(`Baixando [${targetDomain}]: ${mediaUrl}`);

        await youtubedl(mediaUrl, options);

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
        console.error("Erro interno yt-dlp:", err.message);
        return res.status(500).json({ error: "Falha ao extrair a mídia protegida.", detail: err.message });
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

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor rodando na porta ${PORT}`));
