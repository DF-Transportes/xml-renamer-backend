import nextConnect from 'next-connect';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import xml2js from 'xml2js';
import JSZip from 'jszip';

const upload = multer({ dest: '/tmp' });

const apiRoute = nextConnect({
    onError(error, req, res) {
        console.error('Erro geral:', error);
        res.status(500).json({ error: `Erro interno: ${error.message}` });
    },
    onNoMatch(req, res) {
        res.status(405).json({ error: `Método ${req.method} não permitido` });
    },
});

// CORS middleware
apiRoute.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'https://xml-renamer-frontend.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
});

apiRoute.use(upload.array('files'));

apiRoute.post(async (req, res) => {
    try {
        const files = req.files;
        const zip = new JSZip();

        for (const file of files) {
            const filePath = file.path;
            const xmlContent = fs.readFileSync(filePath, 'utf8');

            const parsed = await xml2js.parseStringPromise(xmlContent, { explicitArray: false });
            let newName = path.parse(file.originalname).name;

            // Você pode colocar aqui sua lógica para renomear baseado em XML

            zip.file(`${newName}.xml`, xmlContent);

            fs.unlinkSync(filePath); // remove temp
        }

        const buffer = await zip.generateAsync({ type: 'nodebuffer' });

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=renomeados.zip');
        return res.status(200).send(buffer);
    } catch (err) {
        console.error('Erro durante processamento:', err);
        return res.status(500).json({ error: 'Falha ao processar os arquivos.' });
    }
});

export const config = {
    api: {
        bodyParser: false,
    },
};

export default apiRoute;
