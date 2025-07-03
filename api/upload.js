import nextConnect from 'next-connect';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import xml2js from 'xml2js';

const upload = multer({ dest: '/tmp' });

const apiRoute = nextConnect({
    onError(error, req, res) {
        res.status(501).json({ error: `Erro no servidor: ${error.message}` });
    },
    onNoMatch(req, res) {
        res.status(405).json({ error: `Método ${req.method} não permitido` });
    },
});

apiRoute.use(upload.array('files'));

apiRoute.post(async (req, res) => {
    const files = req.files;
    const zip = new JSZip();

    for (const file of files) {
        try {
            const xmlContent = fs.readFileSync(file.path, 'utf-8');
            const parsed = await xml2js.parseStringPromise(xmlContent, { explicitArray: false });

            // lógica para novo nome aqui (igual seu código)
            let newName = path.parse(file.originalname).name;

            // ... mesma lógica para newName

            zip.file(`${newName}.xml`, xmlContent);
        } finally {
            fs.unlinkSync(file.path);
        }
    }

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=renomeados.zip');
    res.status(200).send(buffer);
});

export const config = {
    api: {
        bodyParser: false, // multer precisa disso
    },
};

export default apiRoute;
