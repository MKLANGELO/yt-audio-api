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

// GARANTIA DE CACHE: Alocado limite pesado de 100MB para payloads no Express
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

app.post('/', async (req, res) => {
    // Evita que o Express encerre a conexão prematuramente antes do yt-dlp terminar
    req.setTimeout(300000); 

    const mediaUrl = req.body.url;
    const mode = req.body.mode || 'video';
    const browserCookies = req.body.cookies;

    if (!mediaUrl) return res.status(400).json({ error: "Missing 'url' parameter." });

    let cookieFilePath = null;
    try {
        const targetDomain = new URL(mediaUrl).hostname.replace('www.', '');
        
        if (Array.isArray(browserCookies) && browserCookies.length > 0) {
            cookieFilePath = path.join(DOWNLOADS_DIR, `cookies_${Date.now()}.txt`);
            let netscapeCookieContent = "# Netscape HTTP Cookie File\n# https://curl.se/docs/http/cookies.html\n\n";
            
            browserCookies.forEach(c => {
                let domain = c.domain;
                if (!domain.startsWith('.')) domain = '.' + domain;
                const includeSubDomains = 'TRUE';
                const pathUrl = c.path || '/';
                const secure = c.secure ? 'TRUE' : 'FALSE';
                const expiry = c.expirationDate ? Math.floor(c.expirationDate) : 2147483647;

                netscapeCookieContent += `${domain}\t${includeSubDomains}\t${pathUrl}\t${secure}\t${expiry}\t${c.name}\t${c.value}\n`;
            });
            fs.writeFileSync(cookieFilePath, netscapeCookieContent);
        }

        const outputTemplate = path.join(DOWNLOADS_DIR, `${Date.now()}_%(title)s.%(ext)s`);
        
        // AUMENTO DE TIMEOUT E RETENTATIVAS (Superando o modelo Python antigo)
        const options = {
            output: outputTemplate,
            noCheckCertificates: true,
            geoBypass: true,
            noPlaylist: true,
            noWarnings: true,
            preferFreeFormats: true,
            format: 'best[ext=mp4]/best',
            socketTimeout: 300,  // 5 Minutos de tolerância para download sem quebrar
            retries: 30          // 30 tentativas se o host rejeitar
        };

        if (cookieFilePath) {
            options.cookies = cookieFilePath;
            if (targetDomain.includes('youtube')) {
                options.extractorArgs = 'youtube:player_client=web'; 
            } else {
                options.addHeader = [
                    'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    `Referer: https://www.${targetDomain}/`
                ];
            }
        }

        console.log(`Extraindo [${targetDomain}] com Timeout de 300s...`);

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
    res.status(500).json({ error: "Erro interno.", detail: err.message });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor Blindado rodando na porta ${PORT}`));
