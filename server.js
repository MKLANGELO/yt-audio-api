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

// Rota de Processamento e Gravação Server-Side
app.post('/record-stream', async (req, res) => {
    req.setTimeout(300000); 
    cleanOldFiles();

    const mediaUrl = req.body.url;
    const mode = req.body.mode || 'video';
    const browserCookies = req.body.cookies;

    if (!mediaUrl) return res.status(400).json({ error: "Parâmetro 'url' ausente." });

    let cookieFilePath = null;
    try {
        const urlObj = new URL(mediaUrl);
        const targetDomain = urlObj.hostname.includes('youtube.com') ? 'youtube.com' : urlObj.hostname.replace('www.', '');

        if (Array.isArray(browserCookies) && browserCookies.length > 0) {
            cookieFilePath = path.join(DOWNLOADS_DIR, `cookies_rec_${Date.now()}.txt`);
            let netscapeContent = "# Netscape HTTP Cookie File\n\n";
            browserCookies.forEach(c => {
                let d = c.domain.startsWith('.') ? c.domain : `.${c.domain}`;
                netscapeContent += `${d}\tTRUE\t${c.path || '/'}\t${c.secure ? 'TRUE' : 'FALSE'}\t${c.expirationDate ? Math.floor(c.expirationDate) : 2147483647}\t${c.name}\t${c.value}\n`;
            });
            fs.writeFileSync(cookieFilePath, netscapeContent);
        }

        const filePrefix = `rec_${Date.now()}`;
        const outputTemplate = path.join(DOWNLOADS_DIR, `${filePrefix}_%(title)s.%(ext)s`);
        
        let options = {
            output: outputTemplate,
            noCheckCertificates: true,
            geoBypass: true,
            noPlaylist: true,
            noWarnings: true,
            ffmpegLocation: ffmpegPath,
            socketTimeout: 300,
            retries: 30,
            // Força recodificação e salvamento direto do stream bruto no disco do servidor
            format: mode === 'audio' ? 'bestaudio/best' : 'best[ext=mp4]/best'
        };

        if (cookieFilePath) {
            options.cookies = cookieFilePath;
        }

        if (targetDomain.includes('youtube.com')) {
            options.extractorArgs = 'youtube:player_client=android,web';
        }

        if (mode === 'audio') {
            options.extractAudio = true;
            options.audioFormat = 'mp3';
            options.audioQuality = 0;
        }

        console.log(`[SERVER STREAM RECORDER] Gravando stream no servidor [${targetDomain}] | URL: ${mediaUrl}`);
        
        await youtubedl(mediaUrl, options);

        if (cookieFilePath && fs.existsSync(cookieFilePath)) fs.unlinkSync(cookieFilePath);

        const files = fs.readdirSync(DOWNLOADS_DIR);
        const generatedFile = files.find(f => f.startsWith(`${filePrefix}_`) && !f.endsWith('.txt') && !f.endsWith('.part'));

        if (!generatedFile) {
            throw new Error("O servidor não conseguiu consolidar a gravação do stream.");
        }

        const downloadToken = `${req.protocol}://${req.get('host')}/download/${encodeURIComponent(generatedFile)}`;
        return res.json({ token: downloadToken, file: generatedFile });

    } catch (err) {
        if (cookieFilePath && fs.existsSync(cookieFilePath)) fs.unlinkSync(cookieFilePath);
        console.error("[SERVER RECORDER ERROR]", err.message);
        return res.status(500).json({ error: "Falha na gravação server-side do stream.", detail: err.message });
    }
});

app.get('/download/:filename', (req, res) => {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = path.join(DOWNLOADS_DIR, filename);
    
    if (fs.existsSync(filePath)) {
        res.download(filePath, filename, (err) => {
            // Limpa o cache imediatamente após o download ser concluído pelo cliente
            setTimeout(() => {
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log(`[CACHE CLEAN] Arquivo de stream removido do servidor: ${filename}`);
                    }
                } catch(e){}
            }, 2000);
        });
    } else {
        res.status(404).json({ error: "Arquivo expirado ou já limpo do cache." });
    }
});

app.listen(process.env.PORT || 10000, '0.0.0.0', () => console.log("Servidor de Gravação Server-Side Ativo."));
