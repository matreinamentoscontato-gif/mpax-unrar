const http = require('http');
const { createExtractorFromData } = require('node-unrar-js');

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

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
      if (!file) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: 'file obrigatorio' }));
        return;
      }

      const rarBuffer = Buffer.from(file, 'base64');
      console.log('[MPAX] RAR: ' + rarBuffer.length + ' bytes | sig: ' + rarBuffer.slice(0,8).toString('hex'));

      const extractor = await createExtractorFromData({ data: rarBuffer });

      const list = extractor.getFileList();
      const listedFiles = [...list.files];
      console.log('[MPAX] Arquivos listados: ' + listedFiles.length);
      listedFiles.forEach(f => console.log('[MPAX] -> ' + f.fileHeader.name + ' size=' + f.fileHeader.unpSize));

      const result = extractor.extract({ files: [] });
      const files = [];
      for (const f of result.files) {
        const name = f.fileHeader.name;
        console.log('[MPAX] extract: ' + name + ' | buf=' + (f.extraction ? f.extraction.length : 'NULL'));
        if (name.toLowerCase().endsWith('.xml') && f.extraction) {
          files.push({ name: name.split(/[\\/]/).pop(), content: Buffer.from(f.extraction).toString('base64') });
        }
      }

      console.log('[MPAX] Total XMLs: ' + files.length);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, files }));

    } catch (e) {
      console.error('[MPAX] ERRO: ' + e.message + '\n' + e.stack);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  });
});

server.listen(PORT, () => console.log('MPAX Unrar server port ' + PORT));
