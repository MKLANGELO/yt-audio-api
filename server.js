const express = require('express');
const cors = require('cors');
const youtubedl = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs');
const ffmpegPath = require('ffmpeg-static');
const { execSync } = require('child_process');

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

app.get('/disk', (req, res) => {
    try {
        const dfOutput = execSync('df -h /').toString();
        return res.json({ success: true, diskUsage: dfOutput.trim().split('\n') });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao ler espaço em disco." });
    }
});

function sanitizeUrl(inputUrl) {
    try {
        const parsed = new URL(inputUrl);
        if (parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be')) {
            if (parsed.searchParams.has('v')) return `https://www.youtube.com/watch?v=${parsed.searchParams.get('v')}`;
        }
        return inputUrl;
    } catch (e) { return inputUrl; }
}

// === MÓDULO DE SEPARAÇÃO POR REDE SOCIAL ===
function configurePlatformOptions(domain, options) {
    const genericUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

    if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
        // YOUTUBE
        options.extractorArgs = 'youtube:player_client=android,web';
        options.addHeader = [
            `User-Agent: ${genericUserAgent}`,
            'Accept-Language: pt-BR,pt;q=0.9',
            'Referer: https://www.youtube.com/'
        ];
    } 
    else if (domain.includes('instagram.com')) {
        // INSTAGRAM (Reels, Stories, Posts)
        options.addHeader = [
            `User-Agent: ${genericUserAgent}`,
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Referer: https://www.instagram.com/'
        ];
    } 
    else if (domain.includes('facebook.com') || domain.includes('fb.watch')) {
        // FACEBOOK (Vídeos, Reels, Posts)
        options.addHeader = [
            `User-Agent: ${genericUserAgent}`,
            'Sec-Fetch-Mode: navigate',
            'Referer: https://www.facebook.com/'
        ];
    } 
    else if (domain.includes('tiktok.com')) {
        // TIKTOK
        options.addHeader = [
            'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Referer: https://www.tiktok.com/'
        ];
    } 
    else {
        // OUTRAS REDES (Genérico)
        options.addHeader = [`User-Agent: ${genericUserAgent}`];
    }
}

async function processMedia(req, res, isRecordMode = false) {
    req.setTimeout(300000); 
    cleanOldFiles();

    const rawUrl = req.body.url;
    const mediaUrl = sanitizeUrl(rawUrl);
    const mode = req.body.mode || 'video'; // Modos: 'video', 'audio', 'image'
    const browserCookies = req.body.cookies;

    if (!mediaUrl) return res.status(400).json({ error: "Parâmetro 'url' ausente." });

    let cookieFilePath = null;
    try {
        const urlObj = new URL(mediaUrl);
        const targetDomain = urlObj.hostname.replace('www.', '');

        if (Array.isArray(browserCookies) && browserCookies.length > 0) {
            cookieFilePath = path.join(DOWNLOADS_DIR, `cookies_${Date.now()}.txt`);
            let netscapeContent = "# Netscape HTTP Cookie File\n\n";
            browserCookies.forEach(c => {
                let d = c.domain.startsWith('.') ? c.domain : `.${c.domain}`;
                netscapeContent += `${d}\tTRUE\t${c.path || '/'}\t${c.secure ? 'TRUE' : 'FALSE'}\t${c.expirationDate ? Math.floor(c.expirationDate) : 2147483647}\t${c.name}\t${c.value}\n`;
            });
            fs.writeFileSync(cookieFilePath, netscapeContent);
        }

        const filePrefix = isRecordMode ? `rec_${Date.now()}` : Date.now();
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

        if (cookieFilePath) options.cookies = cookieFilePath;

        // CONFIGURAÇÃO DOS MODOS (VÍDEO, ÁUDIO, IMAGEM)
        if (mode === 'audio') {
            options.extractAudio = true;
            options.audioFormat = 'mp3';
            options.audioQuality = 0;
            options.format = 'bestaudio/best';
        } else if (mode === 'image') {
            // Se for modo imagem, mandamos ele focar na foto do post ou gravar a thumbnail
            options.writeThumbnail = true;
            // Evitamos fundir formatos de vídeo, pega a mídia nativa.
            options.format = 'best'; 
            // Ignorar o download do vídeo PESADO caso queiramos apenas a capa (thumbnail)
            if(!targetDomain.includes('instagram.com') && !targetDomain.includes('facebook.com')) {
                options.skipDownload = true; 
            }
        } else {
            // MODO VÍDEO PADRÃO
            options.format = 'bestvideo+bestaudio/best';
            options.mergeOutputFormat = 'mp4';
        }

        // APLICA CONFIGURAÇÕES ESPECÍFICAS DE CADA REDE
        configurePlatformOptions(targetDomain, options);

        console.log(`[ENGINE] Rede: [${targetDomain}] | Modo: ${mode} | URL: ${mediaUrl}`);
        
        await youtubedl(mediaUrl, options);

        if (cookieFilePath && fs.existsSync(cookieFilePath)) fs.unlinkSync(cookieFilePath);

        const files = fs.readdirSync(DOWNLOADS_DIR);
        
        // Extensões Válidas atualizadas para aceitar IMAGENS
        const validExtensions = ['.mp4', '.mp3', '.webm', '.m4a', '.jpg', '.jpeg', '.png', '.webp', '.gif'];
        
        // Procurar o arquivo gerado. Se tiver mais de um (ex: vídeo e thumbnail), e for modo imagem, pega a imagem.
        let generatedFile = files.find(f => f.startsWith(`${filePrefix}_`) && f.match(/\.(jpg|jpeg|png|webp|gif)$/i));
        
        // Se não achou imagem (ou não era modo imagem), pega o arquivo normal (vídeo/audio)
        if (!generatedFile || mode !== 'image') {
             generatedFile = files.find(f => f.startsWith(`${filePrefix}_`) && validExtensions.some(ext => f.endsWith(ext)));
        }

        if (!generatedFile) throw new Error("A extração final falhou ou a rede bloqueou o acesso.");

        const downloadToken = `${req.protocol}://${req.get('host')}/download/${encodeURIComponent(generatedFile)}`;
        return res.json({ token: downloadToken, file: generatedFile });

    } catch (err) {
        if (cookieFilePath && fs.existsSync(cookieFilePath)) fs.unlinkSync(cookieFilePath);
        console.error("[CONVERT ERROR]", err.message);
        return res.status(500).json({ error: "Falha na conversão.", detail: err.message });
    }
}

app.post('/', (req, res) => processMedia(req, res, false));
app.post('/record-stream', (req, res) => processMedia(req, res, true));

app.get('/download/:filename', (req, res) => {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = path.join(DOWNLOADS_DIR, filename);
    
    if (fs.existsSync(filePath)) {
        res.download(filePath, filename, (err) => {
            setTimeout(() => {
                try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch(e){}
            }, 2000);
        });
    } else {
        res.status(404).json({ error: "Arquivo expirado." });
    }
});

app.listen(process.env.PORT || 10000, '0.0.0.0', () => console.log("Servidor Híbrido Ativo."));
