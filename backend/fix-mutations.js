import fs from 'fs';
import path from 'path';

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace missing db, doc, collection, etc. inside mutations with fetch
  
  // UserManagement.tsx
  if (filePath.includes('UserManagement.tsx')) {
    content = content.replace(/import .*? 'firebase\/firestore';/, '');
    content = content.replace(/import \{ db \}.*?;/, '');
    
    // collection(db, 'users')
    content = content.replace(/collection\(db, 'users'\)/g, "[]");
    
    // await deleteDoc(doc(db, 'users', id));
    content = content.replace(/await deleteDoc\(doc\(db, 'users', (.*?)\)\);/g, "await fetch(`/api/users/\${$1}`, { method: 'DELETE' });");
    
    // await updateDoc(doc(db, 'users', confirmResetPassword.id), ...
    content = content.replace(/await updateDoc\(doc\(db, 'users', (.*?)\), \{([\s\S]*?)\}\);/g, "await fetch(`/api/users/\${$1}`, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({$2}) });");
    
    // const newDoc = doc(collection(db, 'users')); await setDoc(newDoc, { ... })
    content = content.replace(/const newDoc = doc\(collection\(db, 'users'\)\);\s*await setDoc\(newDoc, \{([\s\S]*?)\}\);/g, "await fetch('/api/users', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({$1}) });");
  }

  // SystemMaintenance.tsx
  if (filePath.includes('SystemMaintenance.tsx')) {
    content = content.replace(/const configRef = doc\(db, 'system', 'config'\);/g, "");
    content = content.replace(/await setDoc\(doc\(db, 'system', 'config'\), config\);/g, "await fetch('/api/system', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(config) });");
  }

  // AuditLog.tsx
  if (filePath.includes('AuditLog.tsx')) {
    content = content.replace(/collection\(db, 'auditLog'\)/g, "[]");
  }

  // InventoryManagement.tsx
  if (filePath.includes('InventoryManagement.tsx')) {
       // The Book modal transaction fetching uses String(bookId), wait let's check
       // error TS2304: Cannot find name 'bookId'.
       content = content.replace(/String\(t.bookId\) === String\(bookId\)/g, "String(t.bookId) === String(selectedBook?.id)");
  }
  
  fs.writeFileSync(filePath, content);
}

const dir = 'src/pages/admin';
fs.readdirSync(dir).forEach(file => {
  if (file.endsWith('.tsx')) fixFile(path.join(dir, file));
});
