const express = require('express');
const cors = require('cors');
const youtubedl = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs');
const ffmpegPath = require('ffmpeg-static');

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));

const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

app.post('/', async (req, res) => {
    req.setTimeout(300000); 

    const mediaUrl = req.body.url;
    const mode = req.body.mode || 'video';
    const browserCookies = req.body.cookies;

    if (!mediaUrl) return res.status(400).json({ error: "Missing 'url'." });

    let cookieFilePath = null;
    try {
        const targetDomain = new URL(mediaUrl).hostname.replace('www.', '');
        
        if (Array.isArray(browserCookies) && browserCookies.length > 0) {
            cookieFilePath = path.join(DOWNLOADS_DIR, `cookies_${Date.now()}.txt`);
            let netscapeContent = "# Netscape HTTP Cookie File\n# https://curl.se/docs/http/cookies.html\n\n";
            browserCookies.forEach(c => {
                let d = c.domain.startsWith('.') ? c.domain : `.${c.domain}`;
                netscapeContent += `${d}\tTRUE\t${c.path || '/'}\t${c.secure ? 'TRUE' : 'FALSE'}\t${c.expirationDate ? Math.floor(c.expirationDate) : 2147483647}\t${c.name}\t${c.value}\n`;
            });
            fs.writeFileSync(cookieFilePath, netscapeContent);
        }

        const baseFileName = `${Date.now()}_%(title)s.%(ext)s`;
        const outputTemplate = path.join(DOWNLOADS_DIR, baseFileName);
        
        const options = {
            output: outputTemplate,
            noCheckCertificates: true,
            geoBypass: true,
            noPlaylist: true,
            noWarnings: true,
            ffmpegLocation: ffmpegPath, // Conecta a ferramenta de conversão nativa
            socketTimeout: 300,
            retries: 30
        };

        if (cookieFilePath) {
            options.cookies = cookieFilePath;
            if (targetDomain.includes('youtube')) options.extractorArgs = 'youtube:player_client=web'; 
        }

        if (mode === 'audio') {
            // Se for áudio: extrai e converte pesado pra MP3
            console.log(`Conversão de Áudio Ativada via FFmpeg: ${mediaUrl}`);
            options.extractAudio = true;
            options.audioFormat = 'mp3';
            options.audioQuality = 0;
            options.format = 'bestaudio/best';
        } else {
            // Se for vídeo: baixa a melhor mídia original unificada, sem forçar mp4
            console.log(`Baixando Formato Original de Vídeo: ${mediaUrl}`);
            options.format = 'best'; 
            options.preferFreeFormats = true;
        }

        await youtubedl(mediaUrl, options);

        if (cookieFilePath && fs.existsSync(cookieFilePath)) fs.unlinkSync(cookieFilePath);

        const files = fs.readdirSync(DOWNLOADS_DIR);
        const recentFile = files
            .filter(f => !f.endsWith('.txt'))
            .map(f => ({ name: f, time: fs.statSync(path.join(DOWNLOADS_DIR, f)).mtime.getTime() }))
            .sort((a, b) => b.time - a.time)[0];

        if (!recentFile) throw new Error("Falha na geração do arquivo.");

        return res.json({ token: `${req.protocol}://${req.get('host')}/download/${recentFile.name}`, file: recentFile.name });

    } catch (err) {
        if (cookieFilePath && fs.existsSync(cookieFilePath)) fs.unlinkSync(cookieFilePath);
        console.error("Erro yt-dlp:", err.message);
        return res.status(500).json({ error: "Falha na conversão/download.", detail: err.message });
    }
});

app.get('/download/:filename', (req, res) => {
    const filePath = path.join(DOWNLOADS_DIR, req.params.filename);
    if (fs.existsSync(filePath)) {
        res.download(filePath, req.params.filename, (err) => {
            if (!err) setTimeout(() => { try { fs.unlinkSync(filePath); } catch(e){} }, 10000);
        });
    } else res.status(404).json({ error: "Arquivo expirado." });
});

app.listen(process.env.PORT || 10000, '0.0.0.0');
