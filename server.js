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

async function resolveMaskedUrl(inputUrl) {
    let url = inputUrl;
    try {
        if (url.includes('vm.tiktok.com') || url.includes('vt.tiktok.com')) {
            const response = await fetch(url, {
                redirect: 'follow',
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' }
            });
            url = response.url;
        }
        
        // LIMPEZA DA URL (REMOÇÃO DE RASTREADORES E PARÂMETROS)
        const parsed = new URL(url);
        
        if (parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be')) {
            if (parsed.searchParams.has('v')) return `https://www.youtube.com/watch?v=${parsed.searchParams.get('v')}`;
        }
        
        // NOVA REGRA TIKTOK: Remove TUDO depois do ID do vídeo (apaga o ?is_from_webapp...)
        if (parsed.hostname.includes('tiktok.com')) {
            return `${parsed.origin}${parsed.pathname}`;
        }

        return url;
    } catch (e) {
        return inputUrl; 
    }
}

function configurePlatformOptions(domain, options) {
    const genericUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

    if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
        options.addHeader = [
            `User-Agent: ${genericUserAgent}`,
            'Accept-Language: pt-BR,pt;q=0.9',
            'Referer: https://www.youtube.com/'
        ];
    } 
    else if (domain.includes('instagram.com')) {
        options.addHeader = [
            `User-Agent: ${genericUserAgent}`,
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Referer: https://www.instagram.com/'
        ];
    } 
    else if (domain.includes('facebook.com') || domain.includes('fb.watch')) {
        options.addHeader = [
            `User-Agent: ${genericUserAgent}`,
            'Sec-Fetch-Mode: navigate',
            'Referer: https://www.facebook.com/'
        ];
    } 
    else if (domain.includes('tiktok.com')) {
        // Tática de User-Agent Mobile para o TikTok, costuma ser menos bloqueado que o PC
        options.addHeader = [
            'User-Agent: Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36',
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Referer: https://www.tiktok.com/'
        ];
    } 
    else {
        options.addHeader = [`User-Agent: ${genericUserAgent}`];
    }
}

async function processMedia(req, res, isRecordMode = false) {
    req.setTimeout(300000); 
    cleanOldFiles();

    const rawUrl = req.body.url;
    if (!rawUrl) return res.status(400).json({ error: "Parâmetro 'url' ausente." });

    const mediaUrl = await resolveMaskedUrl(rawUrl);
    const mode = req.body.mode || 'video'; 
    const browserCookies = req.body.cookies;

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
            retries: 30,
            noWriteInfoJson: true 
        };

        if (cookieFilePath) options.cookies = cookieFilePath;

        if (mode === 'audio') {
            options.extractAudio = true;
            options.audioFormat = 'mp3';
            options.audioQuality = 0;
            options.format = 'bestaudio/best';
        } else if (mode === 'image') {
            options.writeThumbnail = true;
            options.format = 'best'; 
            if(!targetDomain.includes('instagram.com') && !targetDomain.includes('facebook.com')) {
                options.skipDownload = true; 
            }
        } else {
            options.format = 'bestvideo+bestaudio/best';
            options.mergeOutputFormat = 'mp4';
        }

        configurePlatformOptions(targetDomain, options);

        console.log(`[ENGINE] Rede: [${targetDomain}] | URL Final Limpa: ${mediaUrl}`);
        
        await youtubedl(mediaUrl, options);

        if (cookieFilePath && fs.existsSync(cookieFilePath)) fs.unlinkSync(cookieFilePath);

        const files = fs.readdirSync(DOWNLOADS_DIR);
        const validExtensions = ['.mp4', '.mp3', '.webm', '.m4a', '.jpg', '.jpeg', '.png', '.webp', '.gif'];
        
        let generatedFile = files.find(f => f.startsWith(`${filePrefix}_`) && f.match(/\.(jpg|jpeg|png|webp|gif)$/i));
        
        if (!generatedFile || mode !== 'image') {
             generatedFile = files.find(f => f.startsWith(`${filePrefix}_`) && validExtensions.some(ext => f.endsWith(ext)));
        }

        if (!generatedFile) throw new Error("O vídeo não pôde ser extraído. Proteção ativa da rede.");

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
