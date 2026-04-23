import { db, auth } from './firebase';
import { collection, addDoc } from '@/src/lib/dbClient';

export const logAudit = async (method: string, action: string, status: number = 200) => {
  try {
    const userString = localStorage.getItem('library_user_name') || 'System';

    await addDoc(collection(db, 'audit_logs'), {
      user: userString,
      method,
      action,
      status,
      ts: new Date().toISOString()
    });
  } catch (err) {
    console.error('Audit Log failed', err);
  }
};
