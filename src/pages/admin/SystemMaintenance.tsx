import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { db } from '../../lib/firebase';
import { doc, setDoc, onSnapshot, collection, getDocs } from '@/src/lib/dbClient';
import { logAudit } from '../../lib/audit';

export const SystemMaintenance: React.FC = () => {
  const [restoreConfirm, setRestoreConfirm] = useState('');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [config, setConfig] = useState({
    loanPeriodDays: 14,
    fineRate: 2,
    renewalLimit: 2,
    maxBooks: 3,
    auditRetention: 90,
    backupLimit: 12
  });

  const [schedules, setSchedules] = useState({
    daily: true,
    weekly: true,
    monthly: false
  });

  const backups = [
    { id: 'backup-1', name: 'Auto-Backup (Daily)', date: new Date().toLocaleDateString(), size: '14.2 MB' },
  ];

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'config'), (docSnap) => {
      if (docSnap.exists()) {
        setConfig(prev => ({ ...prev, ...docSnap.data() }));
      }
    });
    return () => unsub();
  }, []);

  const handleBackup = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    toast.info('Generating system backup snapshot...', { duration: 3000 });
    
    try {
      // Setup collections to back up
      const collectionsToBackup = ['users', 'books', 'transactions', 'audit_logs', 'reserves', 'procurements', 'bulkRequests', 'system'];
      const backupData: Record<string, Record<string, any>> = {};

      for (const colName of collectionsToBackup) {
        const querySnapshot = await getDocs(collection(db, colName));
        backupData[colName] = {};
        querySnapshot.forEach((docSnap) => {
          backupData[colName][docSnap.id] = docSnap.data();
        });
      }

      // Generate JSON string
      const backupString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([backupString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Auto-download file
      const a = document.createElement('a');
      a.href = url;
      a.download = `Vemu_Library_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Backup generated and downloaded securely!');
      await logAudit('POST', 'Generated manual system JSON backup', 200);
    } catch (err) {
      console.error('Backup error:', err);
      toast.error('Failed to generate backup payload.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async () => {
    if (restoreConfirm !== 'CONFIRM' || !restoreFile) {
      toast.error('Please upload a JSON file and type CONFIRM to proceed.');
      return;
    }
    
    setIsProcessing(true);
    toast.info('Restoring live database from JSON...', { duration: 10000 });

    try {
      const fileText = await restoreFile.text();
      const backupData = JSON.parse(fileText);
      let opsCount = 0;

      // Iteratively write back to Firestore
      for (const colName of Object.keys(backupData)) {
        const colData = backupData[colName];
        for (const docId of Object.keys(colData)) {
          await setDoc(doc(db, colName, docId), colData[docId]);
          opsCount++;
        }
      }

      toast.success(`System successfully restored! (${opsCount} nodes replaced)`);
      setRestoreConfirm('');
      setRestoreFile(null);
      await logAudit('POST', `Restored system from backup file: ${restoreFile.name}`, 200);
    } catch (err) {
      console.error('Restore error:', err);
      toast.error('Failed to restore from file. Ensure it is a valid backup.json format.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      await setDoc(doc(db, 'system', 'config'), config);
      await logAudit('POST', 'Updated system configurations', 200);
      toast.success('System configuration saved successfully.');
    } catch (error) {
      toast.error('Failed to save configuration');
    }
  };

  return (
    <section className="section active" id="sec-system">
      <div className="section-header">
        <div>
          <h2>System Maintenance</h2>
          <p>Backup, restore, and system configuration controls</p>
        </div>
      </div>

      <div className="maintenance-grid">
        {/* Backup Card */}
        <div className="backup-card">
          <h3>💾 Database Backup</h3>
          <p>Create a secure JSON snapshot of all live Firestore library tables.</p>
          <div className="backup-ts" style={{ marginBottom: '24px', marginTop: '16px' }}>
            <p style={{ fontSize: '.8rem', color: '#6d28d9', margin: 0, paddingRight: '12px' }}>
              This will bundle <strong style={{ fontFamily: 'monospace' }}>users</strong>, <strong style={{ fontFamily: 'monospace' }}>books</strong>, <strong style={{ fontFamily: 'monospace' }}>transactions</strong>, and more into a secure local file.
            </p>
          </div>
          <button className="btn btn-gold" onClick={handleBackup} disabled={isProcessing} style={{ width: '100%' }}>
            {isProcessing ? '⏳ Processing Snapshot...' : '⚡ Generate Secure Backup (JSON)'}
          </button>
        </div>

        {/* Restore Card */}
        <div className="card" style={{ background: 'linear-gradient(135deg,#fff9f9 0%,#fff 100%)' }}>
          <div className="card-header">
            <div>
              <div className="card-title" style={{ color: 'var(--red)' }}>🔴 Cloud Restore</div>
              <div className="card-subtitle">Restricted — rewrites live database tables</div>
            </div>
          </div>
          <div className="card-body">
            <p style={{ fontSize: '.83rem', color: 'var(--text-sec)', lineHeight: 1.6, marginBottom: '16px' }}>
              Upload your generated <strong style={{ color: 'var(--red)' }}>Backup JSON</strong> file. To prevent accidental data loss, type <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--red)' }}>CONFIRM</strong> below.
            </p>
            
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <input 
                type="file" 
                accept=".json" 
                onChange={(e) => setRestoreFile(e.target.files ? e.target.files[0] : null)}
                className="form-control"
                style={{ padding: '8px' }}
              />
            </div>

            <div className="form-group">
              <input 
                className="confirm-field" 
                placeholder="Type CONFIRM to proceed"
                value={restoreConfirm}
                onChange={(e) => setRestoreConfirm(e.target.value)}
              />
            </div>
            
            <button 
              className="btn btn-danger" 
              disabled={restoreConfirm !== 'CONFIRM' || !restoreFile || isProcessing} 
              style={{ width: '100%', marginTop: '12px', opacity: (restoreConfirm === 'CONFIRM' && restoreFile) ? 1 : 0.4 }}
              onClick={handleRestore}
            >
              {isProcessing ? '⏳ Injecting Data...' : '↺ Force Upload & Restore Tables'}
            </button>
          </div>
        </div>
      </div>

      {/* System Settings */}
      <div className="card" style={{ marginTop: '20px' }}>
        <div className="card-header">
          <div className="card-title">⚙️ System Configuration</div>
        </div>
        <div className="card-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Default Loan Period (days)</label>
              <input className="form-control" type="number" value={config.loanPeriodDays} onChange={(e) => setConfig({...config, loanPeriodDays: parseInt(e.target.value)})} min="1" />
            </div>
            <div className="form-group">
              <label className="form-label">Max Books Per Student</label>
              <input className="form-control" type="number" value={config.maxBooks} onChange={(e) => setConfig({...config, maxBooks: parseInt(e.target.value)})} min="1" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Fine Per Day (₹)</label>
              <input className="form-control" type="number" value={config.fineRate} onChange={(e) => setConfig({...config, fineRate: parseInt(e.target.value)})} min="0" />
            </div>
            <div className="form-group">
              <label className="form-label">Renewal Limit (times)</label>
              <input className="form-control" type="number" value={config.renewalLimit} onChange={(e) => setConfig({...config, renewalLimit: parseInt(e.target.value)})} min="0" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Audit Retention (days)</label>
              <input className="form-control" type="number" value={config.auditRetention} onChange={(e) => setConfig({...config, auditRetention: parseInt(e.target.value)})} min="0" />
            </div>
            <div className="form-group">
              <label className="form-label">Backup History Limit</label>
              <input className="form-control" type="number" value={config.backupLimit} onChange={(e) => setConfig({...config, backupLimit: parseInt(e.target.value)})} min="1" />
            </div>
          </div>
          <div style={{ textAlign: 'right', marginTop: '6px' }}>
            <button className="btn btn-primary" onClick={handleSaveConfig}>💾 Save Configuration</button>
          </div>
        </div>
      </div>
    </section>
  );
};
