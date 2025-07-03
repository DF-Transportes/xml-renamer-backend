import nextConnect from 'next-connect';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import xml2js from 'xml2js';
import JSZip from 'jszip';

const upload = multer({ dest: '/tmp' });

const ALLOWED_ORIGIN = 'https://xml-renamer-frontend.vercel.app';

function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const apiRoute = nextConnect({
    onError(error, req, res) {
        setCorsHeaders(res);
        console.error('Erro geral:', error);
        res.status(500).json({ error: `Erro interno: ${error.message}` });
    },
    onNoMatch(req, res) {
        setCorsHeaders(res);
        res.status(405).json({ error: `Método ${req.method} não permitido` });
    },
});

// Middleware para CORS + tratamento de OPTIONS
apiRoute.use((req, res, next) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

apiRoute.use(upload.array('files'));

apiRoute.post(async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            console.warn('Nenhum arquivo recebido.');
            return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
        }

        const zip = new JSZip();

        for (const file of files) {
            const filePath = file.path;
            try {
                const xmlContent = fs.readFileSync(filePath, 'utf8');
                const parsed = await xml2js.parseStringPromise(xmlContent, { explicitArray: false });

                // Ajuste a lógica de renomeação conforme seu XML
                const newName = path.parse(file.originalname).name;

                zip.file(`${newName}.xml`, xmlContent);
            } catch (err) {
                console.error(`Erro ao processar ${file.originalname}:`, err);
            } finally {
                fs.unlink(filePath, () => { }); // Remove arquivo temporário
            }
        }

        const buffer = await zip.generateAsync({ type: 'nodebuffer' });

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=renomeados.zip');
        return res.status(200).send(buffer);
    } catch (err) {
        setCorsHeaders(res);
        console.error('Erro durante o processamento final:', err);
        return res.status(500).json({ error: 'Falha ao processar os arquivos.' });
    }
});

export const config = {
    api: {
        bodyParser: false,
    },
};

export default apiRoute;
