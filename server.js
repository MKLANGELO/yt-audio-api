const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

app.get('/', async (req, res) => {
    let mediaUrl = req.query.url;
    const mode = req.query.mode || 'video';

    if (!mediaUrl) {
        return res.status(400).json({ error: "Missing 'url' parameter in request." });
    }

    if (mediaUrl.includes('youtube.com/watch') && mediaUrl.includes('&list=')) {
        try {
            const urlObj = new URL(mediaUrl);
            const videoId = urlObj.searchParams.get('v');
            if (videoId) {
                mediaUrl = `https://www.youtube.com/watch?v=${videoId}`;
            }
        } catch (e) {}
    }

    if (!ytdl.validateURL(mediaUrl)) {
        return res.status(400).json({ error: "URL inválida ou não suportada pelo YouTube." });
    }

    try {
        const info = await ytdl.getInfo(mediaUrl);
        const title = info.videoDetails.title.replace(/[^a-zA-Z0-9]/g, '_');
        const fileExtension = mode === 'audio' ? 'mp3' : 'mp4';
        const fileName = `${Date.now()}_${title}.${fileExtension}`;
        const filePath = path.join(DOWNLOADS_DIR, fileName);

        const streamOptions = mode === 'audio' 
            ? { quality: 'highestaudio' } 
            : { quality: 'highest' };

        const stream = ytdl(mediaUrl, streamOptions);
        const writeStream = fs.createWriteStream(filePath);

        stream.pipe(writeStream);

        writeStream.on('finish', () => {
            const host = req.get('host');
            const protocol = req.protocol;
            const downloadToken = `${protocol}://${host}/download/${fileName}`;
            return res.json({ token: downloadToken, file: fileName });
        });

        stream.on('error', (err) => {
            console.error("Erro no stream do ytdl:", err);
            if (!res.headersSent) {
                return res.status(500).json({ error: "Falha no download.", detail: err.message });
            }
        });

    } catch (err) {
        console.error("Erro ao obter informações do vídeo:", err);
        return res.status(500).json({ error: "Erro interno ao processar o vídeo.", detail: err.message });
    }
});

app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(DOWNLOADS_DIR, filename);

    if (fs.existsSync(filePath)) {
        res.download(filePath, filename);
    } else {
        res.status(404).json({ error: "Arquivo não encontrado ou expirado." });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Node.js rodando na porta ${PORT}`);
});
