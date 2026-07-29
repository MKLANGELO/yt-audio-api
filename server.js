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
    const customUser = req.body.youtubeUser; // Suporte a login fictício/personalizado para o YouTube
    const customPass = req.body.youtubePass;

    if (!mediaUrl) return res.status(400).json({ error: "Parâmetro 'url' ausente." });

    let cookieFilePath = null;
    try {
        const urlObj = new URL(mediaUrl);
        const targetDomain = urlObj.hostname.includes('youtube.com') ? 'youtube.com' : urlObj.hostname.replace('www.', '');

        // Se o usuário mandou credenciais fictícias para o YouTube, criamos um arquivo .netrc temporário de autenticação
        let netrcPath = null;
        if (targetDomain.includes('youtube.com') && customUser && customPass) {
            netrcPath = path.join(DOWNLOADS_DIR, `netrc_${Date.now()}`);
            fs.writeFileSync(netrcPath, `machine youtube.com login ${customUser} password ${customPass}\n`, { mode: 0o600 });
        }

        if (!targetDomain.includes('youtube.com') && Array.isArray(browserCookies) && browserCookies.length > 0) {
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

        if (netrcPath) {
            options.netrc = true;
            // O yt-dlp lê o arquivo netrc padrão ou configurado nas opções do sistema
        } else if (cookieFilePath) {
            options.cookies = cookieFilePath;
        }

        if (targetDomain.includes('youtube.com')) {
            options.extractorArgs = 'youtube:player_client=mweb,ios,web';
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

        console.log(`[YOUTUBE AUTH ENGINE] Processando URL com login simulado/personalizado: ${mediaUrl}`);
        
        await youtubedl(mediaUrl, options);

        if (cookieFilePath && fs.existsSync(cookieFilePath)) fs.unlinkSync(cookieFilePath);
        if (netrcPath && fs.existsSync(netrcPath)) fs.unlinkSync(netrcPath);

        const files = fs.readdirSync(DOWNLOADS_DIR);
        const generatedFile = files.find(f => f.startsWith(`${filePrefix}_`) && !f.endsWith('.txt') && !f.endsWith('.part') && !f.startsWith('netrc_'));

        if (!generatedFile) {
            throw new Error("Falha na autenticação ou consolidação do arquivo do YouTube.");
        }

        const downloadToken = `${req.protocol}://${req.get('host')}/download/${encodeURIComponent(generatedFile)}`;
        return res.json({ token: downloadToken, file: generatedFile });

    } catch (err) {
        if (cookieFilePath && fs.existsSync(cookieFilePath)) fs.unlinkSync(cookieFilePath);
        console.error("[YOUTUBE AUTH ERROR]", err.message);
        return res.status(500).json({ error: "Falha no login ou extração do YouTube. Conta fictícia rejeitada pelo servidor de origem.", detail: err.message });
    }
});

app.get('/download/:filename', (req, res) => {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = path.join(DOWNLOADS_DIR, filename);
    
    if (fs.existsSync(filePath)) {
        res.download(filePath, filename, (err) => {
            setTimeout(() => {
                try {
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                } catch(e){}
            }, 5000);
        });
    } else {
        res.status(404).json({ error: "Arquivo expirado." });
    }
});

app.listen(process.env.PORT || 10000, '0.0.0.0', () => console.log("Servidor com Módulo de Login YouTube Ativo."));
