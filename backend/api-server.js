import fs from 'fs/promises';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'backend', 'db.json');

async function readDb() {
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return { users: [], books: [], transactions: [], audit_logs: [], auditLog: [], sessions: [], system: [] };
  }
}

async function writeDb(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export const handleApi = async (req, res, url) => {
  const method = req.method;
  const pathName = url.pathname;

  try {
    const db = await readDb();

    // CORS & Options
    if (method === 'OPTIONS') return res.status(200).end();

    // --- AuditLog API helper ---
    const logAudit = async (method, action, user, status = 200) => {
      const log = {
        id: `audit_logs-${Date.now()}`,
        user: user || 'Admin',
        method,
        action,
        status,
        ts: new Date().toISOString()
      };
      db.audit_logs = db.audit_logs || [];
      db.audit_logs.unshift(log);
      if (db.audit_logs.length > 200) db.audit_logs = db.audit_logs.slice(0, 200);
      await writeDb(db);
    };

    
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
        const newDoc = { id: req.body.id || `${collName}-${Date.now()}`, ...req.body };
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

    // --- Books API ---
    if (pathName.startsWith('/api/books')) {
      if (method === 'GET') {
        const id = pathName.split('/').pop();
        if (id && id !== 'books') {
           const book = (db.books || []).find(b => String(b.id) === String(id));
           return book ? res.json(book) : res.status(404).json({ error: 'Book not found' });
        }
        return res.json(db.books || []);
      }
      if (method === 'POST') {
        const newBook = { id: `book-${Date.now()}`, ...req.body };
        db.books = db.books || [];
        db.books.push(newBook);
        await writeDb(db);
        await logAudit('POST', `Added book: ${newBook.title}`, 'Admin');
        return res.status(201).json(newBook);
      }
      if (method === 'PATCH' || method === 'DELETE') {
        const id = pathName.split('/').pop();
        if (!db.books) db.books = [];
        const index = db.books.findIndex(b => String(b.id) === String(id));
        if (index !== -1) {
          if (method === 'PATCH') {
            db.books[index] = { ...db.books[index], ...req.body };
            await writeDb(db);
            await logAudit('PATCH', `Updated book: ${db.books[index].title}`, 'Admin');
            return res.json(db.books[index]);
          } else {
            const deleted = db.books.splice(index, 1);
            await writeDb(db);
            await logAudit('DELETE', `Deleted book: ${deleted[0].title}`, 'Admin');
            return res.json(deleted[0]);
          }
        }
        return res.status(404).json({ error: 'Book not found' });
      }
    }

    // --- Users API ---
    if (pathName.startsWith('/api/users')) {
       if (method === 'GET') {
          return res.json(db.users || []);
       }
       if (method === 'POST') {
          const newUser = { id: `user-${Date.now()}`, ...req.body };
          db.users = db.users || [];
          if (db.users.some(u => u.userId === newUser.userId)) {
             return res.status(400).json({ error: 'User ID already exists' });
          }
          db.users.push(newUser);
          await writeDb(db);
          await logAudit('POST', `Created user: ${newUser.firstName}`, 'Admin');
          return res.status(201).json(newUser);
       }
       if (method === 'PATCH' || method === 'DELETE') {
          const id = pathName.split('/').pop();
          if (!db.users) db.users = [];
          const index = db.users.findIndex(u => String(u.id) === String(id));
          if (index !== -1) {
             if (method === 'PATCH') {
                db.users[index] = { ...db.users[index], ...req.body };
                await writeDb(db);
                await logAudit('PATCH', `Updated user: ${db.users[index].firstName}`, 'Admin');
                return res.json(db.users[index]);
             } else {
                const deleted = db.users.splice(index, 1);
                await writeDb(db);
                await logAudit('DELETE', `Deleted user: ${deleted[0].firstName}`, 'Admin');
                return res.json(deleted[0]);
             }
          }
          return res.status(404).json({ error: 'User not found' });
       }
    }

    // --- Transactions API ---
    if (pathName.startsWith('/api/transactions')) {
      if (method === 'GET') {
        return res.json(db.transactions || []);
      }
      if (method === 'POST') {
        const newTx = { id: `TXN-${Date.now()}`, ...req.body, fine: 0, returned: null };
        db.transactions = db.transactions || [];
        db.transactions.unshift(newTx);
        
        // Update book availability
        const bookIndex = (db.books || []).findIndex(b => String(b.id) === String(newTx.bookId));
        if (bookIndex !== -1) {
          db.books[bookIndex].availCopies = Math.max(0, db.books[bookIndex].availCopies - 1);
          if (db.books[bookIndex].availCopies === 0) {
            db.books[bookIndex].status = 'Loaned';
          }
        }
        
        await writeDb(db);
        await logAudit('Admin', `issued ${newTx.bookTitle} to ${newTx.userName}`);
        return res.status(201).json(newTx);
      }
    }

    // --- AuditLog API ---
    if (pathName === '/api/auditLog') {
       if (method === 'GET') return res.json(db.auditLog || []);
    }

    // --- Stats API for Dashboard ---
    if (pathName === '/api/stats' && method === 'GET') {
      const users = db.users || [];
      const books = db.books || [];
      const tx = db.transactions || [];
      
      const totalBooks = books.reduce((acc, b) => acc + (b.totalCopies || 0), 0);
      const activeLoans = tx.filter(t => t.status === 'Borrowed' || t.status === 'Overdue').length;
      const overdue = tx.filter(t => t.status === 'Overdue').length;
      
      return res.json({
        totalUsers: users.length,
        totalBooks,
        activeLoans,
        overdueCount: overdue
      });
    }

    // --- Reports API ---
    if (pathName === '/api/reports/data' && method === 'GET') {
       const users = db.users || [];
       const books = db.books || [];
       
       // Group users by month joined
       const growth = {};
       users.forEach(u => {
         const m = new Date(u.joined || '2026-04-01').toLocaleString('en-US', { month: 'short' });
         growth[m] = (growth[m] || 0) + 1;
       });

       // Categories distribution
       const cats = {};
       books.forEach(b => {
         cats[b.category] = (cats[b.category] || 0) + 1;
       });

       return res.json({ growth, cats });
    }
    
    // --- Dashboard portal data (Used by legacy HTML portal) ---
    if (pathName === '/api/portal-data' || pathName === '/api/librarian/overview') {
      if (method === 'GET') {
         // Get bearer token to figure out user
         const authHeader = req.headers.authorization || '';
         const token = authHeader.replace('Bearer ', '');
         const session = db.sessions?.find(s => s.token === token);
         const user = db.users?.find(u => u.id === session?.userId) || db.users[0];
         
         const currentBooks = (db.transactions || []).filter(t => t.userId === user?.userId && t.status === 'Borrowed');
         
         return res.json({
           user: user || {},
           books: db.books || [],
           transactions: db.transactions || [],
           currentBooks,
           stats: {
             booksIssued: currentBooks.length,
             dueSoon: currentBooks.filter(b => b.isOverdue).length,
             pendingFines: 0
           },
           notifications: [],
           recommendations: (db.books || []).slice(0, 5)
         });
      }
    }

    // --- Authentication ---
    if (pathName === '/api/auth/login' && method === 'POST') {
      const { identifier, password, role } = req.body || {};
      
      const inputId = (identifier || '').trim();
      const inputPassword = (password || '').trim();
      
      // Strict constraint: only @vemu.org users are allowed. If the identifier contains an '@', it MUST be '@vemu.org'
      if (inputId.includes('@') && !inputId.toLowerCase().endsWith('@vemu.org')) {
        return res.status(403).json({ error: 'Access Denied: Only @vemu.org domain accounts are permitted.' });
      }

      const user = db.users.find(u => {
        const matchIdentifier = 
          (u.email && u.email.toLowerCase() === inputId.toLowerCase()) || 
          (u.userId && u.userId.toLowerCase() === inputId.toLowerCase());
          
        return matchIdentifier && 
               u.password === inputPassword &&
               (!role || u.role.toLowerCase() === (role || '').trim().toLowerCase());
      });
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Final db-level assertion just in case an older account is logged in via UserID instead of email
      if (user.email && !user.email.toLowerCase().endsWith('@vemu.org')) {
        return res.status(403).json({ error: 'Access Denied: Your account does not have a @vemu.org domain.' });
      }

      const token = `tok_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      if (!db.sessions) db.sessions = [];
      db.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });
      await writeDb(db);

      return res.json({ token, user });
    }

    if (pathName === '/api/auth/me' && method === 'GET') {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace('Bearer ', '');
      const session = db.sessions?.find(s => s.token === token);
      if (!session) return res.status(401).json({ error: 'Unauthorized' });
      
      const user = db.users?.find(u => u.id === session.userId);
      if (!user) return res.status(401).json({ error: 'User not found' });
      
      return res.json({ user });
    }
    
    if (pathName === '/api/auth/logout' && method === 'POST') {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace('Bearer ', '');
      if (db.sessions) {
        db.sessions = db.sessions.filter(s => s.token !== token);
        await writeDb(db);
      }
      return res.json({ success: true });
    }

    return res.status(404).json({ error: "Endpoint not found" });
  } catch (err) {
    console.error("API Error", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
