import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: '.env.example' });
}

let client;
let mongoDbInstance;

async function getDb() {
  if (mongoDbInstance) return mongoDbInstance;
  let uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI not found. Please provide the connection string in the Secrets menu.');
  }
  
  // Fix unencoded password characters like '@'
  if (uri.startsWith('mongodb')) {
    const protocolEnd = uri.indexOf('://') + 3;
    const lastAt = uri.lastIndexOf('@');
    if (protocolEnd > 2 && lastAt > protocolEnd) {
      const authPart = uri.substring(protocolEnd, lastAt);
      const firstColon = authPart.indexOf(':');
      if (firstColon !== -1) {
        const user = authPart.substring(0, firstColon);
        let pass = authPart.substring(firstColon + 1);
        if (pass.includes('@') && !pass.includes('%40')) {
          pass = encodeURIComponent(pass);
          uri = uri.substring(0, protocolEnd) + user + ':' + pass + uri.substring(lastAt);
        }
      }
    }
  }

  client = new MongoClient(uri);
  await client.connect();
  mongoDbInstance = client.db('lms_database');
  return mongoDbInstance;
}

export const handleApi = async (req, res, url) => {
  const method = req.method;
  const pathName = url.pathname;

  try {
    const db = await getDb();

    // CORS & Options
    if (method === 'OPTIONS') return res.status(200).end();

    // --- AuditLog API helper ---
    const logAudit = async (actionMethod, action, user, status = 200) => {
      const log = {
        id: `audit_logs-${Date.now()}`,
        user: user || 'Admin',
        method: actionMethod,
        action,
        status,
        ts: new Date().toISOString()
      };
      await db.collection('audit_logs').insertOne(log);
    };

    
    // --- Generic DB API ---
    if (pathName.startsWith('/api/db/')) {
      const parts = pathName.split('/');
      const collName = parts[3];
      const docId = parts[4];

      const collection = db.collection(collName);

      if (method === 'GET') {
        if (docId) {
          const doc = await collection.findOne({ id: docId });
          return doc ? res.json(doc) : res.status(404).json({ error: 'Not found' });
        }
        const docs = await collection.find({}).toArray();
        return res.json(docs);
      }
      
      if (method === 'POST') {
        // Create doc with auto ID or specified ID
        const newDoc = { id: req.body.id || `${collName}-${Date.now()}`, ...req.body };
        await collection.insertOne(newDoc);
        delete newDoc._id; // remove mongo _id
        return res.status(201).json(newDoc);
      }
      
      if (method === 'PATCH' || method === 'PUT') {
        if (!docId) return res.status(400).json({ error: 'Missing ID' });
        
        if (method === 'PUT') {
          // Create or replace
          const newDoc = { id: docId, ...req.body };
          await collection.updateOne({ id: docId }, { $set: newDoc }, { upsert: true });
          return res.json(newDoc);
        } else {
          // PATCH
          const existing = await collection.findOne({ id: docId });
          if (!existing) return res.status(404).json({ error: 'Not found' });
          const updatedDoc = { ...existing, ...req.body };
          await collection.updateOne({ id: docId }, { $set: updatedDoc });
          delete updatedDoc._id;
          return res.json(updatedDoc);
        }
      }
      
      if (method === 'DELETE') {
        if (!docId) return res.status(400).json({ error: 'Missing ID' });
        const existing = await collection.findOne({ id: docId });
        if (!existing) return res.status(404).json({ error: 'Not found' });
        await collection.deleteOne({ id: docId });
        delete existing._id;
        return res.json(existing);
      }
    }

    // --- Books API ---
    if (pathName.startsWith('/api/books')) {
      const collection = db.collection('books');
      if (method === 'GET') {
        const id = pathName.split('/').pop();
        if (id && id !== 'books') {
           const book = await collection.findOne({ id: id });
           return book ? res.json(book) : res.status(404).json({ error: 'Book not found' });
        }
        const docs = await collection.find({}).toArray();
        return res.json(docs);
      }
      if (method === 'POST') {
        const newBook = { id: `book-${Date.now()}`, ...req.body };
        await collection.insertOne(newBook);
        await logAudit('POST', `Added book: ${newBook.title}`, 'Admin');
        delete newBook._id;
        return res.status(201).json(newBook);
      }
      if (method === 'PATCH' || method === 'DELETE') {
        const id = pathName.split('/').pop();
        const existing = await collection.findOne({ id: id });
        if (existing) {
          if (method === 'PATCH') {
            const updated = { ...existing, ...req.body };
            await collection.updateOne({ id: id }, { $set: updated });
            await logAudit('PATCH', `Updated book: ${updated.title}`, 'Admin');
            delete updated._id;
            return res.json(updated);
          } else {
            await collection.deleteOne({ id: id });
            await logAudit('DELETE', `Deleted book: ${existing.title}`, 'Admin');
            delete existing._id;
            return res.json(existing);
          }
        }
        return res.status(404).json({ error: 'Book not found' });
      }
    }

    // --- Users API ---
    if (pathName.startsWith('/api/users')) {
      const collection = db.collection('users');
       if (method === 'GET') {
          const docs = await collection.find({}).toArray();
          return res.json(docs);
       }
       if (method === 'POST') {
          const newUser = { id: `user-${Date.now()}`, ...req.body };
          const existing = await collection.findOne({ userId: newUser.userId });
          if (existing) {
             return res.status(400).json({ error: 'User ID already exists' });
          }
          await collection.insertOne(newUser);
          await logAudit('POST', `Created user: ${newUser.firstName}`, 'Admin');
          delete newUser._id;
          return res.status(201).json(newUser);
       }
       if (method === 'PATCH' || method === 'DELETE') {
          const id = pathName.split('/').pop();
          const existing = await collection.findOne({ id: id });
          if (existing) {
             if (method === 'PATCH') {
                const updated = { ...existing, ...req.body };
                await collection.updateOne({ id: id }, { $set: updated });
                await logAudit('PATCH', `Updated user: ${updated.firstName}`, 'Admin');
                delete updated._id;
                return res.json(updated);
             } else {
                await collection.deleteOne({ id: id });
                await logAudit('DELETE', `Deleted user: ${existing.firstName}`, 'Admin');
                delete existing._id;
                return res.json(existing);
             }
          }
          return res.status(404).json({ error: 'User not found' });
       }
    }

    // --- Transactions API ---
    if (pathName.startsWith('/api/transactions')) {
      const collection = db.collection('transactions');
      const booksColl = db.collection('books');
      
      if (method === 'GET') {
        const docs = await collection.find({}).toArray();
        return res.json(docs);
      }
      if (method === 'POST') {
        const newTx = { id: `TXN-${Date.now()}`, ...req.body, fine: 0, returned: null };
        await collection.insertOne(newTx);
        
        // Update book availability
        const book = await booksColl.findOne({ id: newTx.bookId });
        if (book) {
          const availCopies = Math.max(0, book.availCopies - 1);
          const status = availCopies === 0 ? 'Loaned' : book.status;
          await booksColl.updateOne({ id: newTx.bookId }, { $set: { availCopies, status } });
        }
        
        await logAudit('Admin', `issued ${newTx.bookTitle} to ${newTx.userName}`);
        delete newTx._id;
        return res.status(201).json(newTx);
      }
    }

    // --- AuditLog API ---
    if (pathName === '/api/auditLog') {
       if (method === 'GET') {
          const docs = await db.collection('auditLog').find({}).toArray();
          return res.json(docs);
       }
    }

    // --- Stats API for Dashboard ---
    if (pathName === '/api/stats' && method === 'GET') {
      const usersCount = await db.collection('users').countDocuments();
      const books = await db.collection('books').find({}).toArray();
      const tx = await db.collection('transactions').find({}).toArray();
      
      const totalBooks = books.reduce((acc, b) => acc + (b.totalCopies || 0), 0);
      const activeLoans = tx.filter(t => t.status === 'Borrowed' || t.status === 'Overdue').length;
      const overdue = tx.filter(t => t.status === 'Overdue').length;
      
      return res.json({
        totalUsers: usersCount,
        totalBooks,
        activeLoans,
        overdueCount: overdue
      });
    }

    // --- Reports API ---
    if (pathName === '/api/reports/data' && method === 'GET') {
       const users = await db.collection('users').find({}).toArray();
       const books = await db.collection('books').find({}).toArray();
       
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
         
         const session = await db.collection('sessions').findOne({ token });
         let user = null;
         
         if (session) {
           user = await db.collection('users').findOne({ id: session.userId });
         } else {
           user = await db.collection('users').findOne({}); // fallback
         }
         
         const currentBooks = await db.collection('transactions').find({ 
           userId: user?.userId, 
           status: 'Borrowed' 
         }).toArray();
         
         const allBooks = await db.collection('books').find({}).toArray();
         const allTx = await db.collection('transactions').find({}).toArray();
         
         return res.json({
           user: user || {},
           books: allBooks,
           transactions: allTx,
           currentBooks,
           stats: {
             booksIssued: currentBooks.length,
             dueSoon: currentBooks.filter(b => b.isOverdue).length,
             pendingFines: 0
           },
           notifications: [],
           recommendations: allBooks.slice(0, 5)
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

      // We perform filtering here directly as mongodb queries handles regex/lowercasing separately
      // but let's just fetch everything and do the logic in JS since it's a small app
      const allUsers = await db.collection('users').find({}).toArray();
      
      const user = allUsers.find(u => {
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
      await db.collection('sessions').insertOne({ token, userId: user.id || user.userId, createdAt: new Date().toISOString() });

      delete user._id; // remove internal mongo id from payload
      return res.json({ token, user });
    }

    if (pathName === '/api/auth/me' && method === 'GET') {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace('Bearer ', '');
      const session = await db.collection('sessions').findOne({ token });
      if (!session) return res.status(401).json({ error: 'Unauthorized' });
      
      const user = await db.collection('users').findOne({ id: session.userId });
      if (!user) return res.status(401).json({ error: 'User not found' });
      
      delete user._id;
      return res.json({ user });
    }
    
    if (pathName === '/api/auth/logout' && method === 'POST') {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace('Bearer ', '');
      await db.collection('sessions').deleteOne({ token });
      return res.json({ success: true });
    }

    return res.status(404).json({ error: "Endpoint not found" });
  } catch (err) {
    if (err.message && err.message.includes("MONGODB_URI not found")) {
      return res.status(500).json({ error: err.message });
    }
    console.error("API Error", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

