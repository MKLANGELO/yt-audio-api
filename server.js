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
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json());

const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

app.get('/', async (req, res) => {
    const mediaUrl = req.query.url;
    const mode = req.query.mode || 'video';
    const browserCookies = req.headers['x-browser-cookies'];

    if (!mediaUrl) {
        return res.status(400).json({ error: "Missing 'url' parameter in request." });
    }

    let cookieFilePath = null;
    try {
        if (browserCookies) {
            cookieFilePath = path.join(DOWNLOADS_DIR, `cookies_${Date.now()}.txt`);
            let netscapeCookieContent = "# Netscape HTTP Cookie File\n";
            browserCookies.split(';').forEach(cookie => {
                const parts = cookie.trim().split('=');
                if (parts.length >= 2) {
                    const name = parts[0];
                    const value = parts.slice(1).join('=');
                    netscapeCookieContent += `.instagram.com\tTRUE\t/\tFALSE\t2147483647\t${name}\t${value}\n`;
                    netscapeCookieContent += `.youtube.com\tTRUE\t/\tFALSE\t2147483647\t${name}\t${value}\n`;
                    netscapeCookieContent += `.xvideos.com\tTRUE\t/\tFALSE\t2147483647\t${name}\t${value}\n`;
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
            format: 'best[ext=mp4]/best'
        };

        if (cookieFilePath) {
            options.cookies = cookieFilePath;
        }

        if (mode === 'audio') {
            options.extractAudio = true;
            options.audioFormat = 'mp3';
            delete options.format;
        }

        console.log(`Baixando via youtube-dl-exec: ${mediaUrl}`);

        await youtubedl(mediaUrl, options);

        if (cookieFilePath && fs.existsSync(cookieFilePath)) {
            try { fs.unlinkSync(cookieFilePath); } catch (e) {}
        }

        const files = fs.readdirSync(DOWNLOADS_DIR);
        const recentFile = files
            .filter(f => !f.endsWith('.txt'))
            .map(f => ({ name: f, time: fs.statSync(path.join(DOWNLOADS_DIR, f)).mtime.getTime() }))
            .sort((a, b) => b.time - a.time)[0];

        if (!recentFile) {
            return res.status(500).json({ error: "Arquivo gerado não encontrado no servidor." });
        }

        const host = req.get('host');
        const protocol = req.protocol;
        const downloadToken = `${protocol}://${host}/download/${recentFile.name}`;

        return res.json({ token: downloadToken, file: recentFile.name });

    } catch (err) {
        if (cookieFilePath && fs.existsSync(cookieFilePath)) {
            try { fs.unlinkSync(cookieFilePath); } catch (e) {}
        }
        console.error("Erro no youtube-dl-exec:", err);
        return res.status(500).json({ error: "Falha ao processar download.", detail: err.message });
    }
});

app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(DOWNLOADS_DIR, filename);

    if (fs.existsSync(filePath)) {
        res.download(filePath, filename, (err) => {
            if (!err) {
                setTimeout(() => {
                    try { fs.unlinkSync(filePath); } catch (e) {}
                }, 10000);
            }
        });
    } else {
        res.status(404).json({ error: "Arquivo não encontrado ou expirado." });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Universal rodando na porta ${PORT}`);
});
