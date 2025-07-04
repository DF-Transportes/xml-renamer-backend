const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const JSZip = require('jszip');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'upload/' });

app.post('/upload', upload.array('files'), async (req, res) => {
    const files = req.files;
    const zip = new JSZip();

    // Controle de nomes dentro de cada pasta
    const folderNameTracker = {}; // { '600': { '263_600': 1, ... }, ... }

    for (const file of files) {
        try {
            const xmlContent = fs.readFileSync(file.path, 'utf-8');
            const parsed = await xml2js.parseStringPromise(xmlContent, { explicitArray: false });

            let baseName;

            // Modelo 1 — trata obsCont como array, objeto ou com atributos
            const obsCont = parsed.nfeProc?.NFe?.infNFe?.infAdic?.obsCont;
            if (Array.isArray(obsCont)) {
                for (const item of obsCont) {
                    const campo = item?.xCampo || item?.$?.xCampo;
                    const texto = item?.xTexto || item?.$?.xTexto;
                    if (campo === 'CODIGO_DO_GIRO' && texto) {
                        const matches = texto.match(/\d+_\d+/g);
                        if (matches?.[0]) {
                            baseName = matches[0];
                            break;
                        }
                    }
                }
            } else if (obsCont) {
                const campo = obsCont?.xCampo || obsCont?.$?.xCampo;
                const texto = obsCont?.xTexto || obsCont?.$?.xTexto;
                if (campo === 'CODIGO_DO_GIRO' && texto) {
                    const matches = texto.match(/\d+_\d+/g);
                    if (matches?.[0]) {
                        baseName = matches[0];
                    }
                }
            }

            // Modelo 2 (fallback)
            if (!baseName) {
                const infCpl = parsed.nfeProc?.NFe?.infNFe?.infAdic?.infCpl;
                const rotaMatch = infCpl?.match(/Rota:\s*(\d+\/\d+)/);
                if (rotaMatch) baseName = rotaMatch[1].replace('/', '_');
            }

            // Nome fallback: nome original sem extensão
            if (!baseName) {
                baseName = path.parse(file.originalname).name;
            }

            const folderName = baseName.split('_')[1] || 'outros';

            if (!folderNameTracker[folderName]) {
                folderNameTracker[folderName] = {};
            }

            let finalName = baseName;
            if (folderNameTracker[folderName][baseName]) {
                const count = ++folderNameTracker[folderName][baseName];
                finalName = `${baseName}_${count}`;
            } else {
                folderNameTracker[folderName][baseName] = 1;
            }

            zip.folder(folderName).file(`${finalName}.xml`, xmlContent);
        } catch (err) {
            console.error(`Erro ao processar ${file.originalname}:`, err);
        } finally {
            fs.unlinkSync(file.path);
        }
    }

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename=renomeados.zip',
    });

    res.send(buffer);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server rodando na porta ${PORT}`);
});
