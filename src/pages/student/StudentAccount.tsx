import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { db, auth } from '../../lib/firebase';
import { collection, onSnapshot, query, where, doc, setDoc, updateDoc } from '@/src/lib/dbClient';
import { signOut } from 'firebase/auth';
import { toast } from 'sonner';
import { ProfileModal } from '../../components/ProfileModal';
import { NotificationBell } from '../../components/NotificationBell';
import './student.css';

export default function StudentAccount() {
  const { user, logout } = useAuth();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Real-time Data
  const [books, setBooks] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Books');

  // Modal control
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  
  const [bookDetailModalOpen, setBookDetailModalOpen] = useState(false);
  const [reserveModalOpen, setReserveModalOpen] = useState(false);
  const [idModalOpen, setIdModalOpen] = useState(false);
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);

  // Firestore bindings
  useEffect(() => {
    if (!user) return;
    
    // Live catalog listener
    const unsubBooks = onSnapshot(collection(db, 'books'), (snap) => {
      setBooks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    // Live personal transactions listener
    const qTx = query(collection(db, 'transactions'), where('userId', '==', user.uid));
    const unsubTx = onSnapshot(qTx, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubBooks(); unsubTx(); };
  }, [user]);

  if (!user) return <Navigate to="/login" replace />;

  const nav = (sec: string) => setActiveSection(sec);

  const userName = user.displayName || user.email?.split('@')[0] || 'Student';
  const userEmail = user.email || '';

  // Derived metrics
  const myCurrentBooks = transactions.filter(t => ['Borrowed', 'Overdue'].includes(t.status));
  const outstandingFines = transactions.filter(t => (Number(t.fine) || 0) > 0 && t.fineStatus !== 'Paid' && t.status !== 'Paid');
  const totalFines = outstandingFines.reduce((sum, t) => sum + (Number(t.fine) || 0), 0);
  const totalPaid = transactions.filter(t => t.fineStatus === 'Paid').reduce((sum, t) => sum + (Number(t.fine) || 0), 0);

  const filteredBooks = books.filter(b => {
    if (categoryFilter !== 'All Books' && b.category !== categoryFilter && b.category !== 'General Fiction') return false;
    if (searchQuery && !`${b.title} ${b.author} ${b.isbn}`.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const timelineEvents = [...transactions]
    .sort((a, b) => new Date(b.checkout || 0).getTime() - new Date(a.checkout || 0).getTime())
    .map(t => ({
      icon: t.status === 'Borrowed' ? '📚' : t.status.includes('Pending') ? '⏳' : t.status === 'Returned' ? '✅' : '💳',
      text: `${t.status.replace(/_/g, ' ')}: ${t.bookTitle}`,
      meta: t.checkout || t.finePaymentDate || 'Recent'
    }));

  // Actions
  const handleRequestBook = async () => {
    if (!selectedBook) return;
    const isAvailable = selectedBook.availCopies > 0;
    try {
      const reqId = `REQ-${Date.now()}`;
      await setDoc(doc(db, 'transactions', reqId), {
        userId: user.uid,
        userName,
        bookId: selectedBook.id,
        bookTitle: selectedBook.title,
        checkout: new Date().toISOString().split('T')[0],
        due: 'Pending Approval',
        status: isAvailable ? 'Reserve_Pending' : 'Waitlist_Pending',
        fine: 0,
        fineStatus: 'None'
      });
      toast.success(isAvailable ? "Pickup request sent to desk!" : "Joined waitlist!");
      setReserveModalOpen(false);
      setBookDetailModalOpen(false);
    } catch (err) {
      toast.error("Failed to submit request.");
    }
  };

  const handlePayFine = async () => {
    if (!selectedTx) return;
    try {
      await updateDoc(doc(db, 'transactions', selectedTx.id), {
        fineStatus: 'Paid',
        finePaymentDate: new Date().toISOString().split('T')[0]
      });
      toast.success("Payment securely processed.");
      setPayModalOpen(false);
    } catch (err) {
      toast.error("Payment failed.");
    }
  };

  const handleRenew = async () => {
    if (!selectedTx) return;
    try {
      await updateDoc(doc(db, 'transactions', selectedTx.id), {
        status: 'Renewal_Pending',
        renewalRequestedDate: new Date().toISOString().split('T')[0]
      });
      toast.success("Renewal request sent to librarian.");
      setRenewModalOpen(false);
    } catch (err) {
      toast.error("Failed to request renewal.");
    }
  };

  const handleLogout = async () => {
    try {
      logout();
    } catch (err) {
      toast.error("Failed to log out.");
    }
  };

  return (
    <>
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
      {/* Modals */}
      {bookDetailModalOpen && selectedBook && (
        <div className="ovl open" onClick={(e) => { if(e.target === e.currentTarget) setBookDetailModalOpen(false) }}>
          <div className="modal modal-lg">
            <div className="mhdr">
              <h3>{selectedBook.title}</h3>
              <button className="mcls" onClick={() => setBookDetailModalOpen(false)}>✕</button>
            </div>
            <div className="mbdy">
              <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                <div style={{ background: 'var(--violet-bg)', width: '100px', height: '140px', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', flexShrink: 0 }}>📖</div>
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--ink)' }}>{selectedBook.title}</div>
                  <div style={{ color: 'var(--txt-3)', marginBottom: '8px' }}>by {selectedBook.author}</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span className="pill p-violet">{selectedBook.category}</span>
                    <span className={`pill ${selectedBook.availCopies > 0 ? 'p-green' : 'p-amber'}`}>
                      {selectedBook.availCopies > 0 ? `${selectedBook.availCopies} available` : 'Waitlist'}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                 <div style={{ border: '1px solid var(--border)', padding: '10px', borderRadius: 'var(--r-md)' }}>
                   <div style={{ fontSize: '.7rem', color: 'var(--txt-4)', textTransform: 'uppercase' }}>ISBN</div>
                   <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.9rem', color: 'var(--ink)' }}>{selectedBook.isbn}</div>
                 </div>
                 <div style={{ border: '1px solid var(--border)', padding: '10px', borderRadius: 'var(--r-md)' }}>
                   <div style={{ fontSize: '.7rem', color: 'var(--txt-4)', textTransform: 'uppercase' }}>Location</div>
                   <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.9rem', color: 'var(--ink)' }}>{selectedBook.location || 'Main Shelf'}</div>
                 </div>
              </div>
            </div>
            <div className="mftr">
              <button className="btn btn-outline" onClick={() => setBookDetailModalOpen(false)}>Close</button>
              <button className="btn btn-violet" onClick={() => { setBookDetailModalOpen(false); setReserveModalOpen(true); }}>
                {selectedBook.availCopies > 0 ? '📥 Reserve for Pickup' : '⏳ Join Waitlist'}
              </button>
            </div>
          </div>
        </div>
      )}

      {reserveModalOpen && selectedBook && (
        <div className="ovl open" onClick={(e) => { if(e.target === e.currentTarget) setReserveModalOpen(false) }}>
          <div className="modal">
            <div className="mhdr">
              <h3>{selectedBook.availCopies > 0 ? '📥 Confirm Pickup Request' : '⏳ Confirm Waitlist'}</h3>
              <button className="mcls" onClick={() => setReserveModalOpen(false)}>✕</button>
            </div>
            <div className="mbdy">
              <p style={{ fontSize: '.85rem', color: 'var(--txt-3)', marginBottom: '14px' }}>
                {selectedBook.availCopies > 0 ? `Please confirm your request for "${selectedBook.title}". This will notify the librarian to prepare the book.` : `There are no active copies of "${selectedBook.title}". Confirm to join the dynamic queue.`}
              </p>
            </div>
            <div className="mftr">
              <button className="btn btn-outline" onClick={() => setReserveModalOpen(false)}>Cancel</button>
              <button className="btn btn-violet" onClick={handleRequestBook}>Confirm Action</button>
            </div>
          </div>
        </div>
      )}

      {renewModalOpen && selectedTx && (
        <div className="ovl open" onClick={(e) => { if(e.target === e.currentTarget) setRenewModalOpen(false) }}>
          <div className="modal">
            <div className="mhdr">
              <h3>🕒 Request Renewal</h3>
              <button className="mcls" onClick={() => setRenewModalOpen(false)}>✕</button>
            </div>
            <div className="mbdy">
              <div style={{ background: 'var(--violet-bg)', border: '1.5px solid rgba(109,40,217,.2)', borderRadius: 'var(--r-lg)', padding: '16px', marginBottom: '14px' }}>
                <div style={{ fontSize: '.88rem', fontWeight: 700, color: 'var(--ink)' }}>{selectedTx.bookTitle}</div>
                <div style={{ fontSize: '.75rem', color: 'var(--txt-3)', marginTop: '4px' }}>Current due: <strong style={{ color: 'var(--rose)' }}>{selectedTx.due}</strong></div>
              </div>
              <p style={{ fontSize: '.8rem', color: 'var(--txt-3)' }}>This will push a live renewal request to the administration for approval.</p>
            </div>
            <div className="mftr">
              <button className="btn btn-outline" onClick={() => setRenewModalOpen(false)}>Cancel</button>
              <button className="btn btn-violet" onClick={handleRenew}>✅ Confirm Renewal</button>
            </div>
          </div>
        </div>
      )}

      {payModalOpen && selectedTx && (
        <div className="ovl open" onClick={(e) => { if(e.target === e.currentTarget) setPayModalOpen(false) }}>
          <div className="modal">
            <div className="mhdr">
              <h3>💳 Pay Outstanding Fine</h3>
              <button className="mcls" onClick={() => setPayModalOpen(false)}>✕</button>
            </div>
            <div className="mbdy">
              <div className="fine-card" style={{ textAlign: 'center', marginBottom: '16px', padding: '20px', borderRadius: 'var(--r-lg)', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '.75rem', color: 'var(--rose)', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '8px' }}>Outstanding Amount</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--ink)' }}>₹{selectedTx.fine}</div>
                <div style={{ fontSize: '.75rem', color: 'var(--txt-3)', marginTop: '6px' }}>For: {selectedTx.bookTitle}</div>
              </div>
              <div className="fg">
                <label className="flbl">Payment Method</label>
                <select className="fc">
                  <option>UPI (Google Pay / PhonePe)</option>
                  <option>Net Banking</option>
                  <option>Debit / Credit Card</option>
                </select>
              </div>
            </div>
            <div className="mftr">
              <button className="btn btn-outline" onClick={() => setPayModalOpen(false)}>Cancel</button>
              <button className="btn btn-violet" onClick={handlePayFine}>💳 Process Secure Payment</button>
            </div>
          </div>
        </div>
      )}

      {idModalOpen && (
        <div className="ovl open" onClick={(e) => { if(e.target === e.currentTarget) setIdModalOpen(false) }}>
          <div className="modal">
            <div className="mhdr">
              <h3>🪪 Digital Library Card</h3>
              <button className="mcls" onClick={() => setIdModalOpen(false)}>✕</button>
            </div>
            <div className="mbdy">
              <div className="id-modal-card">
                <div style={{ fontSize: '.65rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: '12px' }}>Vemu Institute of Technology</div>
                <div className="id-modal-name">{userName}</div>
                <div className="id-modal-roll">{userEmail}</div>
                <div style={{ background: '#fff', height: '40px', width: '100%', margin: '14px 0', opacity: 0.8, borderRadius: '4px' }}></div>
              </div>
            </div>
            <div className="mftr">
              <button className="btn btn-violet" onClick={() => setIdModalOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Main App Shell */}
      <div className="app">
        <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
          <button className="sb-toggle" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>◀</button>
          <div className="sb-head">
            <div className="sb-logo">📚</div>
            <div className="sb-brand">My Library<small>Student Portal</small></div>
          </div>
          <nav className="sb-nav">
            <div className="sb-grp">Home</div>
            <div className={`sb-link ${activeSection === 'dashboard' ? 'active' : ''}`} onClick={() => nav('dashboard')}>
              <div className="ico">🏠</div><span className="lbl">My Dashboard</span>
            </div>
            <div className="sb-grp">Browse</div>
            <div className={`sb-link ${activeSection === 'discover' ? 'active' : ''}`} onClick={() => nav('discover')}>
              <div className="ico">🔍</div><span className="lbl">Discover Books</span>
            </div>
            <div className="sb-grp">My Space</div>
            <div className={`sb-link ${activeSection === 'activity' ? 'active' : ''}`} onClick={() => nav('activity')}>
              <div className="ico">📖</div><span className="lbl">My Activity</span>
            </div>
            <div className={`sb-link ${activeSection === 'fines' ? 'active' : ''}`} onClick={() => nav('fines')}>
              <div className="ico">⚖️</div><span className="lbl">Fines & Payments</span>
            </div>
          </nav>
          <div className="sb-foot">
            <div className="sb-user" onClick={() => setIsProfileModalOpen(true)} style={{ cursor: 'pointer' }}>
              <div className="sb-av" style={{ background: 'var(--violet)', color: 'white' }}>{userName[0]}</div>
              <div className="sb-uinfo">
                <div className="sb-uname">{userName}</div>
                <div className="sb-urole">Student</div>
              </div>
            </div>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <div className="topbar-ttl">
              <span>🏠</span>
              <span>{activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}</span>
            </div>
            <div className="topbar-sp"></div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button className="id-btn" onClick={() => setIdModalOpen(true)}>🪪 My ID Card</button>
              <NotificationBell />
              <button 
                onClick={handleLogout}
                style={{ padding: '6px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>🚪</span> Logout
              </button>
            </div>
          </header>

          <div className="content">
            {/* Dashboard Section */}
            {activeSection === 'dashboard' && (
              <section className="section active">
                <div className="welcome-band">
                  <div className="wb-text">
                    <div className="wb-sub">Good morning 🌅</div>
                    <div className="wb-name">Welcome back,<br /><em>{userName}</em></div>
                    <div className="wb-meta">
                      <span>🎓 Student Role</span>
                      <span>📧 {userEmail}</span>
                      <span>📅 {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                  </div>
                  <div className="wb-right">
                    <div className="id-card" onClick={() => setIdModalOpen(true)}>
                      <div className="id-card-label">🪪 Connected to Cloud</div>
                      <div className="id-num" style={{ fontSize: '.85rem', marginTop: '10px' }}>Firebase Sync Active</div>
                    </div>
                  </div>
                </div>

                <div className="stat-row" style={{ marginTop: '20px' }}>
                  <div className="scard">
                    <div className="scard-top">
                      <div className="scard-ico" style={{ background: 'var(--violet-bg)' }}>📚</div>
                      <span className="scard-chip" style={{ background: 'var(--violet-bg)', color: 'var(--violet-2)' }}>Active</span>
                    </div>
                    <div className="scard-num">{myCurrentBooks.length}</div>
                    <div className="scard-lbl">Books Issued</div>
                  </div>
                  <div className="scard">
                    <div className="scard-top">
                      <div className="scard-ico" style={{ background: 'var(--rose-bg)' }}>⏰</div>
                      <span className="scard-chip" style={{ background: 'var(--rose-bg)', color: 'var(--rose)' }}>Notice</span>
                    </div>
                    <div className="scard-num">{transactions.filter(t => t.status === 'Overdue').length}</div>
                    <div className="scard-lbl">Overdue Books</div>
                  </div>
                  <div className="scard">
                    <div className="scard-top">
                      <div className="scard-ico" style={{ background: 'var(--amber-bg)' }}>📋</div>
                      <span className="scard-chip" style={{ background: 'var(--amber-bg)', color: 'var(--amber)' }}>Pending</span>
                    </div>
                    <div className="scard-num">{transactions.filter(t => t.status.includes('Pending')).length}</div>
                    <div className="scard-lbl">Reservations / Renewals</div>
                  </div>
                  <div className="scard">
                    <div className="scard-top">
                      <div className="scard-ico" style={{ background: 'var(--emerald-bg)' }}>💸</div>
                      <span className="scard-chip" style={{ background: 'var(--emerald-bg)', color: 'var(--emerald)' }}>Outstanding</span>
                    </div>
                    <div className="scard-num" style={{ color: totalFines > 0 ? 'var(--rose)' : 'inherit' }}>₹{totalFines}</div>
                    <div className="scard-lbl">Pending Fines</div>
                  </div>
                </div>

                <div className="g-dash-main" style={{ marginTop: '20px' }}>
                  <div className="card">
                    <div className="card-hdr">
                      <div className="card-ttl">📚 Books Pending Action</div>
                      <button className="btn btn-outline btn-sm" onClick={() => nav('activity')}>View All →</button>
                    </div>
                    <div className="card-body">
                      {myCurrentBooks.map(b => (
                        <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', marginBottom: '10px' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '.9rem', color: 'var(--ink)' }}>{b.bookTitle}</div>
                            <div style={{ fontSize: '.75rem', color: 'var(--txt-3)' }}>Due: <strong style={{ color: b.status === 'Overdue' ? 'var(--rose)' : 'var(--emerald)' }}>{b.due}</strong></div>
                          </div>
                          <button className="btn btn-sm btn-outline" onClick={() => { setSelectedTx(b); setRenewModalOpen(true); }}>Renew</button>
                        </div>
                      ))}
                      {myCurrentBooks.length === 0 && <p style={{ fontSize: '.8rem', color: 'var(--txt-3)' }}>No currently issued books.</p>}
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-hdr">
                      <div className="card-ttl">🔔 Cloud Event Feed</div>
                    </div>
                    <div className="card-body">
                      <div className="timeline">
                        {timelineEvents.slice(0, 4).map((ev, i) => (
                          <div className="tline-item" key={i}>
                            <div className="tline-dot">{ev.icon}</div>
                            <div className="tline-body">
                               <div className="tline-msg">{ev.text}</div>
                               <div className="tline-meta">{ev.meta}</div>
                            </div>
                          </div>
                        ))}
                        {timelineEvents.length === 0 && <p style={{ fontSize: '.8rem', color: 'var(--txt-3)' }}>No recent activity natively tracked.</p>}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Discover Section */}
            {activeSection === 'discover' && (
              <section className="section active">
                <div className="discover-search">
                  <div className="ds-label">Live Cloud Catalog Search</div>
                  <div className="ds-field" style={{ marginBottom: '14px' }}>
                    <span className="ds-ico">🔍</span>
                    <input className="ds-input" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Type to search live catalog..." />
                  </div>
                  <div className="ds-tabs">
                     {['All Books', 'Computer Science', 'Electronics', 'Mathematics', 'Management', 'Fiction'].map(cat => (
                        <div key={cat} className={`ds-tab ${categoryFilter === cat ? 'active' : ''}`} onClick={() => setCategoryFilter(cat)}>{cat}</div>
                     ))}
                  </div>
                </div>
                
                <div style={{ fontSize: '.8rem', color: 'var(--txt-3)', marginBottom: '14px' }}>Found {filteredBooks.length} live records.</div>
                
                <div className="books-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                  {filteredBooks.map(b => (
                    <div key={b.id} className="card" style={{ padding: '14px', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid var(--border)', outline: 'none' }} onClick={() => { setSelectedBook(b); setBookDetailModalOpen(true); }}>
                       <div style={{ background: 'var(--blue-bg)', height: '140px', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', marginBottom: '12px' }}>📖</div>
                       <div style={{ fontWeight: 600, fontSize: '.9rem', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title}</div>
                       <div style={{ fontSize: '.75rem', color: 'var(--txt-3)', marginBottom: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.author}</div>
                       <span className={`pill ${b.availCopies > 0 ? 'p-green' : 'p-amber'}`} style={{ fontSize: '.7rem' }}>
                         {b.availCopies > 0 ? `${b.availCopies} Copies` : 'Waitlist'}
                       </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Activity Section */}
            {activeSection === 'activity' && (
              <section className="section active">
                 <div style={{ marginBottom: '20px' }}>
                    <h2 style={{ fontFamily: 'var(--font-d)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--ink)' }}>My Activity</h2>
                 </div>
                 <div className="card" style={{ marginBottom: '20px' }}>
                   <div className="card-hdr"><div className="card-ttl">📋 Live Ledger History</div></div>
                   <div style={{ overflowX: 'auto' }}>
                     <table className="dtbl">
                        <thead>
                           <tr>
                              <th>Event Date</th>
                              <th>Book Reference</th>
                              <th>Status</th>
                              <th>Actions</th>
                           </tr>
                        </thead>
                        <tbody>
                           {transactions.map(t => (
                              <tr key={t.id}>
                                <td>{t.checkout || t.finePaymentDate || 'N/A'}</td>
                                <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{t.bookTitle}</td>
                                <td><span className={`pill ${t.status === 'Borrowed' ? 'p-violet' : t.status.includes('Pending') ? 'p-amber' : 'p-green'}`}>{t.status.replace(/_/g, ' ')}</span></td>
                                <td>
                                  {t.status === 'Borrowed' && <button className="btn btn-sm btn-outline" onClick={() => { setSelectedTx(t); setRenewModalOpen(true); }}>Renew</button>}
                                </td>
                              </tr>
                           ))}
                           {transactions.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: '16px', color: 'var(--txt-3)' }}>No live catalog transactions recorded.</td></tr>}
                        </tbody>
                     </table>
                   </div>
                 </div>
              </section>
            )}

            {/* Fines Section */}
            {activeSection === 'fines' && (
              <section className="section active">
                 <div style={{ marginBottom: '20px' }}>
                    <h2 style={{ fontFamily: 'var(--font-d)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--ink)' }}>Fines & Payments</h2>
                 </div>

                 <div className="card" style={{ marginBottom: '20px' }}>
                    <div className="card-body">
                       <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ fontSize: '2.5rem' }}>⚖️</div>
                          <div>
                             <div style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--txt-4)', marginBottom: '4px' }}>Current Outstanding</div>
                             <div style={{ fontFamily: 'var(--font-d)', fontSize: '2rem', fontWeight: 900, color: totalFines > 0 ? 'var(--rose)' : 'var(--emerald)' }}>₹{totalFines}</div>
                          </div>
                          <div style={{ marginLeft: 'auto', background: 'var(--surface-2)', padding: '14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', textAlign: 'right' }}>
                             <div style={{ fontSize: '.72rem', textTransform: 'uppercase', color: 'var(--txt-4)', marginBottom: '4px' }}>Total Paid History</div>
                             <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--ink)' }}>₹{totalPaid}</div>
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="card">
                   <div className="card-hdr"><div className="card-ttl">💳 Financial Ledger</div></div>
                   <div style={{ overflowX: 'auto' }}>
                     <table className="dtbl">
                        <thead>
                           <tr>
                              <th>Date</th>
                              <th>Reference</th>
                              <th>Reason</th>
                              <th>Amount</th>
                              <th>Status</th>
                              <th>Actions</th>
                           </tr>
                        </thead>
                        <tbody>
                           {outstandingFines.map(t => (
                              <tr key={t.id}>
                                <td>{t.checkout || 'N/A'}</td>
                                <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{t.bookTitle}</td>
                                <td>System Fine</td>
                                <td style={{ color: 'var(--rose)', fontWeight: 600 }}>₹{t.fine}</td>
                                <td><span className="pill p-amber">Outstanding</span></td>
                                <td><button className="btn btn-sm btn-outline" onClick={() => { setSelectedTx(t); setPayModalOpen(true); }}>Pay Now</button></td>
                              </tr>
                           ))}
                           {transactions.filter(t => t.fineStatus === 'Paid').map(t => (
                              <tr key={t.id}>
                                <td>{t.finePaymentDate || t.checkout}</td>
                                <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{t.bookTitle}</td>
                                <td>Settlement</td>
                                <td style={{ color: 'var(--emerald)' }}>₹{t.fine}</td>
                                <td><span className="pill p-green">Cleared</span></td>
                                <td>-</td>
                              </tr>
                           ))}
                           {(outstandingFines.length === 0 && totalPaid === 0) && (
                              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '16px', color: 'var(--txt-3)' }}>Your ledger is completely clean.</td></tr>
                           )}
                        </tbody>
                     </table>
                   </div>
                 </div>
              </section>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
