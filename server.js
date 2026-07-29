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

    if (!mediaUrl) return res.status(400).json({ error: "Parâmetro 'url' ausente." });

    if (mediaUrl === "https://www.facebook.com/" || mediaUrl.match(/^https:\/\/www\.facebook\.com\/[^\/]+\/?$/)) {
        return res.status(400).json({ error: "URL inválida. Abra um vídeo ou reel específico." });
    }

    let cookieFilePath = null;
    try {
        const urlObj = new URL(mediaUrl);
        const targetDomain = urlObj.hostname.includes('facebook.com') ? 'facebook.com' : urlObj.hostname.replace('www.', '');

        if (Array.isArray(browserCookies) && browserCookies.length > 0) {
            cookieFilePath = path.join(DOWNLOADS_DIR, `cookies_${Date.now()}.txt`);
            let netscapeContent = "# Netscape HTTP Cookie File\n\n";
            browserCookies.forEach(c => {
                let d = c.domain.startsWith('.') ? c.domain : `.${c.domain}`;
                netscapeContent += `${d}\tTRUE\t${c.path || '/'}\t${c.secure ? 'TRUE' : 'FALSE'}\t${c.expirationDate ? Math.floor(c.expirationDate) : 2147483647}\t${c.name}\t${c.value}\n`;
            });
            fs.writeFileSync(cookieFilePath, netscapeContent);
        }

        const filePrefix = Date.now();
        const outputTemplate = path.join(DOWNLOADS_DIR, `${filePrefix}_%(title)s.%(ext)s`);
        
        let options = {
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

        // Ajustes assertivos por ecossistema
        if (targetDomain.includes('youtube.com')) {
            options.extractorArgs = 'youtube:player_client=android,web';
        } else if (targetDomain.includes('facebook.com')) {
            if (mediaUrl.includes('/stories/')) {
                options.addHeader = [
                    'User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBDV/iPhone14,2;FBMD/iPhone;FBSN/iOS;FBSV/16.5;FBSS/3;FBID/phone;FBLC/pt_BR;FBOP/5]',
                    'Accept-Language: pt-BR,pt;q=0.9',
                    'Referer: https://www.facebook.com/'
                ];
            } else {
                options.addHeader = [
                    'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language: pt-BR,pt;q=0.9',
                    'Referer: https://www.facebook.com/'
                ];
            }
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

        console.log(`[ASSERTIVE ENGINE] Processando [${targetDomain}] | Modo: ${mode} | URL: ${mediaUrl}`);
        
        await youtubedl(mediaUrl, options);

        if (cookieFilePath && fs.existsSync(cookieFilePath)) fs.unlinkSync(cookieFilePath);

        const files = fs.readdirSync(DOWNLOADS_DIR);
        const generatedFile = files.find(f => f.startsWith(`${filePrefix}_` ) && !f.endsWith('.txt') && !f.endsWith('.part'));

        if (!generatedFile) {
            throw new Error("O motor não conseguiu consolidar o arquivo de mídia no disco.");
        }

        const downloadToken = `${req.protocol}://${req.get('host')}/download/${encodeURIComponent(generatedFile)}`;
        return res.json({ token: downloadToken, file: generatedFile });

    } catch (err) {
        if (cookieFilePath && fs.existsSync(cookieFilePath)) fs.unlinkSync(cookieFilePath);
        console.error("[ENGINE ERROR]", err.message);
        return res.status(500).json({ error: "Falha na extração de mídia. O link pode estar protegido, expirado ou inacessível.", detail: err.message });
    }
});

app.get('/download/:filename', (req, res) => {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = path.join(DOWNLOADS_DIR, filename);
    
    if (fs.existsSync(filePath)) {
        res.download(filePath, filename, (err) => {
            setTimeout(() => {
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log(`[CACHE CLEAN] Arquivo removido com segurança: ${filename}`);
                    }
                } catch(e){}
            }, 5000);
        });
    } else {
        res.status(404).json({ error: "Arquivo expirado ou já limpo do cache." });
    }
});

app.listen(process.env.PORT || 10000, '0.0.0.0', () => console.log("Motor Profissional de Mídia Ativo."));
