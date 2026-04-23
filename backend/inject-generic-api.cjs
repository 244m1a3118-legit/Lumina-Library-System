const fs = require('fs');

const code = `
    // --- Generic DB API ---
    if (pathName.startsWith('/api/db/')) {
      const parts = pathName.split('/');
      const collName = parts[3];
      const docId = parts[4];

      if (!db[collName]) db[collName] = [];

      if (method === 'GET') {
        if (docId) {
          const doc = db[collName].find(d => String(d.id) === String(docId));
          return doc ? res.json(doc) : res.status(404).json({ error: 'Not found' });
        }
        return res.json(db[collName]);
      }
      
      if (method === 'POST') {
        // Create doc with auto ID or specified ID
        const newDoc = { id: req.body.id || \`\${collName}-\${Date.now()}\`, ...req.body };
        db[collName].push(newDoc);
        await writeDb(db);
        return res.status(201).json(newDoc);
      }
      
      if (method === 'PATCH' || method === 'PUT') {
        if (!docId) return res.status(400).json({ error: 'Missing ID' });
        const index = db[collName].findIndex(d => String(d.id) === String(docId));
        if (index === -1) {
          if (method === 'PUT') {
             // Create if not exists (setDoc)
             const newDoc = { id: docId, ...req.body };
             db[collName].push(newDoc);
             await writeDb(db);
             return res.json(newDoc);
          }
          return res.status(404).json({ error: 'Not found' });
        }
        db[collName][index] = { ...db[collName][index], ...req.body };
        await writeDb(db);
        return res.json(db[collName][index]);
      }
      
      if (method === 'DELETE') {
        if (!docId) return res.status(400).json({ error: 'Missing ID' });
        const index = db[collName].findIndex(d => String(d.id) === String(docId));
        if (index === -1) return res.status(404).json({ error: 'Not found' });
        const deleted = db[collName].splice(index, 1);
        await writeDb(db);
        return res.json(deleted[0]);
      }
    }
`;

let content = fs.readFileSync('api-server.js', 'utf8');
content = content.replace('// --- Books API ---', code + '\n    // --- Books API ---');
fs.writeFileSync('api-server.js', content, 'utf8');
