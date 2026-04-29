import { MongoClient } from 'mongodb';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.example' });

let uri = process.env.MONGODB_URI;
if (uri && uri.startsWith('mongodb')) {
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

async function run() {
  if (!uri) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected to MongoDB for migration.");
    const db = client.db('lms_database');
    
    const dbJsonStr = await fs.readFile(path.join(process.cwd(), 'db.json'), 'utf-8');
    const dbData = JSON.parse(dbJsonStr);

    for (const [collectionName, data] of Object.entries(dbData)) {
      if (Array.isArray(data) && data.length > 0) {
        const collection = db.collection(collectionName);
        const count = await collection.countDocuments();
        
        if (count === 0) {
          console.log(`Migrating ${data.length} docs to ${collectionName}...`);
          
          // remove hardcoded _id if present to avoid conflicts, let mongo generate it
          const docsToInsert = data.map(doc => {
            const newDoc = { ...doc };
            delete newDoc._id; 
            return newDoc;
          });
          
          await collection.insertMany(docsToInsert);
          console.log(`Successfully migrated ${collectionName}`);
        } else {
          console.log(`Collection ${collectionName} already has ${count} docs, skipping migration.`);
        }
      }
    }
    
    console.log("Migration complete!");
  } catch (error) {
    console.error("Migration error:", error);
  } finally {
    await client.close();
  }
}

run();
