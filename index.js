const http = require('http');

const PORT = process.env.PORT || 3000;

async function extrairXmlsDoRar(rarBuffer) {
  const { createExtractorFromData } = require('node-unrar-js');

  console.log('[MPAX] RAR: ' + rarBuffer.length + ' bytes');
  console.log('[MPAX] Sig: ' + rarBuffer.slice(0,8).toString('hex'));

  const extractor = await createExtractorFromData({ data: rarBuffer });

  // node-unrar-js v2: getFileList() retorna { arcHeader, fileHeaders (generator) }
  const fileList = extractor.getFileList();

  const headers = [];
  for (const fh of fileList.fileHeaders) {
    headers.push(fh);
    console.log('[MPAX] header: ' + fh.name + ' size=' + fh.unpSize);
  }
  console.log('[MPAX] Total headers: ' + headers.length);

  const xmlNames = headers
    .filter(h => h.name.toLowerCase().endsWith('.xml'))
    .map(h => h.name);

  console.log('[MPAX] XMLs para extrair: ' + xmlNames.length);

  const extracted = extractor.extract({ files: xmlNames });
  const files = [];

  for (const f of extracted.files) {
    console.log('[MPAX] Extraindo: ' + f.fileHeader.name + ' | len=' + (f.extraction ? f.extraction.length : 'NULL'));
    if (f.extraction) {
      files.push({
        name: f.fileHeader.name.split(/[\\/]/).pop(),
        content: Buffer.from(f.extraction).toString('base64')
      });
    }
  }

  return files;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method !== 'POST' || req.url !== '/extract') {
    res.writeHead(404);
    res.end(JSON.stringify({ ok: false, error: 'Not found' }));
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('end', async () => {
    try {
      const { file, filename } = JSON.parse(body);
      if (!file) { res.writeHead(400); res.end(JSON.stringify({ ok: false, error: 'file obrigatorio' })); return; }

      const rarBuffer = Buffer.from(file, 'base64');
      const files = await extrairXmlsDoRar(rarBuffer);

      console.log('[MPAX] Total XMLs: ' + files.length);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, files }));

    } catch (e) {
      console.error('[MPAX] ERRO: ' + e.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  });
});

server.listen(PORT, () => console.log('MPAX Unrar server port ' + PORT));
