import fs from 'fs';
import path from 'path';

function replaceFirestoreInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Skip if not modified
  if (!content.includes('firebase/firestore')) return;

  // Change firebase/firestore import to a fake comment or just keep it
  // Actually, we'll replace the onSnapshot block with a fetch block.

  // 1. Audit Log (AdminDashboard)
  if (filePath.includes('AdminDashboard.tsx')) {
    content = content.replace(/import \{ db, auth \}.*/, '');
    content = content.replace(/import \{ collection, onSnapshot.*?\}.*/, '');
    content = content.replace(/const qFeed =.*/, '');
    content = content.replace(/const unsubFeed = onSnapshot[\s\S]*?\}, \[user\]\);/, `
    const fetchAudits = () => {
      fetch('/api/auditLog').then(res => res.json()).then(data => {
        const logs = data.map((item: any) => ({
          id: item.id || Math.random().toString(),
          icon: '⚡',
          color: 'var(--blue)',
          text: \`<span>\${item.user || 'System'}</span> \${item.action || 'performed an action'}\`,
          meta: item.ts || new Date().toISOString()
        }));
        setActivityFeed(logs);
      }).catch(console.error);
    };
    fetchAudits();
    const interval = setInterval(fetchAudits, 3000);
    return () => clearInterval(interval);
  }, [user]);
    `);
  }

  // 2. InventoryManagement
  if (filePath.includes('InventoryManagement.tsx')) {
    content = content.replace(/import \{ collection, onSnapshot.*?\}.*/, '');
    content = content.replace(/import \{ db \}.*/, '');
    content = content.replace(/const unsubscribe = onSnapshot[\s\S]*?\}, \[\]\);/, `
    const fetchBooks = () => {
      fetch('/api/books').then(res => res.json()).then(data => {
        setBooks(data);
        setLoading(false);
      }).catch(err => {
        console.error(err);
        setLoading(false);
      });
    };
    fetchBooks();
    const interval = setInterval(fetchBooks, 3000);
    return () => clearInterval(interval);
  }, []);
    `);
    
    // modal fetch
    content = content.replace(/const txQuery = query.*?;[\s\S]*?onSnapshot\(txQuery[\s\S]*?\}\);/g, `
    fetch('/api/transactions').then(res => res.json()).then(data => {
      const txData = data.filter((t: any) => String(t.bookId) === String(bookId));
      setBookTransactions(txData);
    });`);
  }

  // 3. UserManagement
  if (filePath.includes('UserManagement.tsx')) {
    content = content.replace(/import \{ collection, onSnapshot.*?\}.*/, '');
    content = content.replace(/import \{ db \}.*/, '');
    content = content.replace(/const unsubscribe = onSnapshot[\s\S]*?\}, \[\]\);/, `
    const fetchUsers = () => {
      fetch('/api/users').then(res => res.json()).then(data => {
        setUsers(data);
        setLoading(false);
      }).catch(console.error);
    };
    fetchUsers();
    const interval = setInterval(fetchUsers, 3000);
    return () => clearInterval(interval);
  }, []);
    `);
  }

  // 4. SystemMaintenance
  if (filePath.includes('SystemMaintenance.tsx')) {
    content = content.replace(/import \{ doc, onSnapshot.*?\}.*/, '');
    content = content.replace(/import \{ db \}.*/, '');
    content = content.replace(/const configRef = doc.*?;[\s\S]*?const unsubscribe = onSnapshot[\s\S]*?\}, \[\]\);/, `
    const fetchSystem = () => {
      fetch('/api/system').then(res => res.json()).then(data => {
        if(data) setConfig(prev => ({ ...prev, ...data }));
      }).catch(console.error);
    };
    fetchSystem();
    const interval = setInterval(fetchSystem, 3000);
    return () => clearInterval(interval);
  }, []);
    `);
  }

  // 5. TransactionManagement
  if (filePath.includes('TransactionManagement.tsx')) {
    content = content.replace(/import \{ collection, onSnapshot.*?\}.*/, '');
    content = content.replace(/import \{ db \}.*/, '');
    content = content.replace(/const unsubscribe = onSnapshot[\s\S]*?\}, \[\]\);/, `
    const fetchTransactions = () => {
      fetch('/api/transactions').then(res => res.json()).then(data => {
        setTransactions(data);
        setLoading(false);
      }).catch(console.error);
    };
    fetchTransactions();
    const interval = setInterval(fetchTransactions, 3000);
    return () => clearInterval(interval);
  }, []);
    `);
  }
  
  // 6. AuditLog
  if (filePath.includes('AuditLog.tsx')) {
    content = content.replace(/import \{ collection, onSnapshot.*?\}.*/, '');
    content = content.replace(/import \{ db \}.*/, '');
    content = content.replace(/const unsubscribe = onSnapshot[\s\S]*?\}, \[\]\);/, `
    const fetchAudit = () => {
      fetch('/api/auditLog').then(res => res.json()).then(data => {
        setLogs(data);
      }).catch(console.error);
    };
    fetchAudit();
    const interval = setInterval(fetchAudit, 3000);
    return () => clearInterval(interval);
  }, []);
    `);
  }

  fs.writeFileSync(filePath, content);
  console.log('Fixed', filePath);
}

const dir = 'src/pages/admin';
fs.readdirSync(dir).forEach(file => {
  if (file.endsWith('.tsx')) replaceFirestoreInFile(path.join(dir, file));
});
