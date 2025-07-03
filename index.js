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

const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.array('files'), async (req, res) => {
    const files = req.files;
    const zip = new JSZip();

    for (const file of files) {
        try {
            const xmlContent = fs.readFileSync(file.path, 'utf-8');
            const parsed = await xml2js.parseStringPromise(xmlContent, { explicitArray: false });

            let newName;

            // Modelo 1 — trata obsCont como array ou objeto
            const obsCont = parsed.nfeProc?.NFe?.infNFe?.infAdic?.obsCont;
            if (Array.isArray(obsCont)) {
                for (const item of obsCont) {
                    if (item.xCampo === 'CODIGO_DO_GIRO' && item.xTexto) {
                        const match = item.xTexto.match(/(\d+_\d+)/);
                        if (match) {
                            newName = match[1];
                            break;
                        }
                    }
                }
            } else if (obsCont?.xCampo === 'CODIGO_DO_GIRO' && obsCont?.xTexto) {
                const match = obsCont.xTexto.match(/(\d+_\d+)/);
                if (match) newName = match[1];
            }

            // Modelo 2 (fallback)
            if (!newName) {
                const infCpl = parsed.nfeProc?.NFe?.infNFe?.infAdic?.infCpl;
                const rotaMatch = infCpl?.match(/Rota:\s*(\d+\/\d+)/);
                if (rotaMatch) newName = rotaMatch[1].replace('/', '_');
            }

            // Nome fallback: nome original sem extensão
            if (!newName) {
                newName = path.parse(file.originalname).name;
            }

            zip.file(`${newName}.xml`, xmlContent);
        } catch (err) {
            console.error(`Erro ao processar ${file.originalname}:`, err);
        } finally {
            // Sempre remove o arquivo temporário
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
