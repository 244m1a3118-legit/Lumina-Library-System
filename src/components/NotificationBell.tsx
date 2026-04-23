import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc, where } from '@/src/lib/dbClient';
import { useAuth } from '../lib/AuthContext';

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [allNotifications, setAllNotifications] = useState<any[]>([]);

  const userId = user?.uid || 'guest';
  const lastClearedKey = `notifs_cleared_${userId}`;
  const lastSeenKey = `notifs_seen_${userId}`;

  const [lastClearedTime, setLastClearedTime] = useState<number>(() => {
    return parseInt(localStorage.getItem(lastClearedKey) || '0', 10);
  });
  const [lastSeenTime, setLastSeenTime] = useState<number>(() => {
    return parseInt(localStorage.getItem(lastSeenKey) || '0', 10);
  });

  useEffect(() => {
    if (!userId || userId === 'guest') return;

    let unsubs: (() => void)[] = [];
    
    let procs: any[] = [];
    let bulks: any[] = [];
    let libTx: any[] = [];
    let libUsers: any = {};
    let studentTx: any[] = [];
    
    const redraw = () => {
        let final: any[] = [];
        final.push(...procs);
        final.push(...bulks);
        
        if (libTx.length > 0) {
            const todayMidnight = new Date().setHours(0,0,0,0);
            libTx.forEach(tx => {
               if (tx.checkout) {
                   const diffTime = Math.abs(Date.now() - new Date(tx.checkout).getTime());
                   const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                   if (diffDays > 45) {
                       const u = libUsers[tx.userId];
                       const phone = u?.phone || 'No phone number';
                       const name = u?.firstName ? `${u.firstName} ${u.lastName}` : 'Member';
                       final.push({
                            id: `lib_overdue_${tx.id}`,
                            user: 'System Alert',
                            action: `${name} has "${tx.bookTitle}" OVERDUE >45 days. Contact: ${phone}`,
                            ts: todayMidnight
                       });
                   }
               }
            });
        }
        
        final.push(...studentTx);
        
        setAllNotifications(final.sort((a,b) => b.ts - a.ts));
    };

    const setup = async () => {
        try {
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);
            const role = userSnap.exists() ? (userSnap.data().role || 'Student') : 'Student';

            if (role === 'Administrator') {
                const uproc = onSnapshot(query(collection(db, 'procurements'), where('status', '==', 'Pending Review')), snap => {
                    procs = snap.docs.map(d => ({
                        id: `proc_${d.id}`, user: d.data().creatorName || 'Faculty', 
                        action: `requested procurement for "${d.data().title}"`,
                        ts: d.data().createdAt ? new Date(d.data().createdAt).getTime() : Date.now()
                    }));
                    redraw();
                });
                unsubs.push(uproc);

                const ubulk = onSnapshot(query(collection(db, 'bulkRequests'), where('status', '==', 'Pending Review')), snap => {
                    bulks = snap.docs.map(d => ({
                        id: `bulk_${d.id}`, user: d.data().creatorName || 'Faculty', 
                        action: `requested bulk issue of ${d.data().copiesRequested || d.data().copies || '?'} copies of "${d.data().bookTitle}"`,
                        ts: d.data().createdAt ? new Date(d.data().createdAt).getTime() : Date.now()
                    }));
                    redraw();
                });
                unsubs.push(ubulk);
            }

            if (role === 'Librarian' || role === 'Librarian Desk') {
                const utx = onSnapshot(query(collection(db, 'transactions'), where('status', 'in', ['Borrowed', 'Overdue'])), snap => {
                    libTx = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    redraw();
                });
                unsubs.push(utx);

                const uusers = onSnapshot(collection(db, 'users'), snap => {
                    libUsers = Object.fromEntries(snap.docs.map(d => [d.data().userId || d.id, d.data()]));
                    redraw();
                });
                unsubs.push(uusers);
            }

            if (role === 'Faculty' || role === 'Student') {
                 const utx = onSnapshot(query(collection(db, 'transactions'), where('userId', '==', userId), where('status', 'in', ['Borrowed', 'Overdue'])), snap => {
                    const todayMidnight = new Date().setHours(0,0,0,0);
                    studentTx = snap.docs.map(d => ({
                        id: `due_${d.id}`, user: 'System Reminder',
                        action: `Daily Reminder: Your book "${d.data().bookTitle}" is due on ${d.data().due}.`,
                        ts: todayMidnight
                    }));
                    redraw();
                });
                unsubs.push(utx);
            }
        } catch (error) {
           console.error("Error setting up notifications:", error);
        }
    };
    
    setup();

    return () => unsubs.forEach(fn => fn());
  }, [userId]);

  const handleOpenNotifications = () => {
    setShowNotifications(true);
    const now = Date.now();
    setLastSeenTime(now);
    localStorage.setItem(lastSeenKey, now.toString());
  };

  const handleClearNotifications = () => {
    const now = Date.now();
    setLastClearedTime(now);
    localStorage.setItem(lastClearedKey, now.toString());
  };

  const handleClose = () => {
    setShowNotifications(false);
  };

  const visibleNotifications = allNotifications.filter(notif => {
    if (!notif.ts) return true;
    const notifTime = new Date(notif.ts).getTime();
    return notifTime > lastClearedTime;
  });

  const unseenCount = visibleNotifications.filter(notif => {
    if (!notif.ts) return true;
    const notifTime = new Date(notif.ts).getTime();
    return notifTime > lastSeenTime;
  }).length;

  return (
    <>
      <button 
        className="topbar-btn" 
        title="Notifications" 
        onClick={handleOpenNotifications} 
        style={{ 
          position: 'relative', 
          background: 'none', 
          border: 'none', 
          cursor: 'pointer', 
          fontSize: '1.2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px',
          borderRadius: '8px',
          transition: 'background 0.2s'
        }}
      >
        <span>🔔</span>
        {unseenCount > 0 && (
          <span className="notif-dot" style={{ 
            display: 'block',
            position: 'absolute',
            top: '4px',
            right: '4px',
            width: '8px',
            height: '8px',
            background: '#ef4444',
            borderRadius: '50%'
          }}></span>
        )}
      </button>

      {/* Notifications Modal Overlay */}
      {showNotifications && (
        <div className="modal-backdrop" onClick={handleClose} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.2)'
        }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{
            position: 'absolute', top: '60px', right: '40px', width: '320px',
            background: 'white', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
            overflow: 'hidden', padding: 0, border: '1px solid #e2e8f0'
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#0f172a' }}>System Notifications</h3>
              <button onClick={handleClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#64748b' }}>×</button>
            </div>
            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
              {visibleNotifications.length > 0 ? visibleNotifications.map((notif, i) => (
                <div key={notif.id || i} style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '12px', background: 'white' }}>
                  <div style={{ fontSize: '1.2rem' }}>⚡</div>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#334155' }}>
                      <span style={{ fontWeight: 600 }}>{notif.user || 'System'}</span> {notif.action}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>
                      {notif.ts ? new Date(notif.ts).toLocaleString() : 'Just now'}
                    </div>
                  </div>
                </div>
              )) : (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: '0.85rem', color: '#64748b', background: 'white' }}>No recent notifications.</div>
              )}
            </div>
            <div style={{ padding: '10px 16px', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0' }}>
              <button onClick={handleClearNotifications} style={{ fontSize: '0.8rem', color: '#64748b', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}>
                Clear All
              </button>
              <button onClick={handleClose} style={{ fontSize: '0.8rem', color: 'white', background: '#3b82f6', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
