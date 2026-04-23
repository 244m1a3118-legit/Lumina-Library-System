import React, { useState, useEffect } from 'react';
// Track sync
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../lib/AuthContext';
import { db, auth } from '../../lib/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc } from '@/src/lib/dbClient';
import { signOut } from 'firebase/auth';
import { logAudit } from '../../lib/audit';
import { ProfileModal } from '../../components/ProfileModal';
import { NotificationBell } from '../../components/NotificationBell';
import { COLORS } from '../../lib/constants';
import './faculty.css';

export default function FacultyDashboard() {
  const { user, logout } = useAuth();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Firestore Data
  const [books, setBooks] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [reserves, setReserves] = useState<any[]>([]);
  const [procurements, setProcurements] = useState<any[]>([]);
  const [bulkRequests, setBulkRequests] = useState<any[]>([]);
  const [systemUser, setSystemUser] = useState<any>(null);
  const [allSystemUsers, setAllSystemUsers] = useState<any[]>([]);

  // Modals
  const [bookDetailModalOpen, setBookDetailModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [deptTab, setDeptTab] = useState('faculty');
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [searchPage, setSearchPage] = useState(1);
  const [catFilter, setCatFilter] = useState('');
  const [availFilter, setAvailFilter] = useState('');
  const booksPerPage = 8;
  
  // Reserve Draft State
  const [reserveDraft, setReserveDraft] = useState<any[]>([]);
  const [reserveCourseName, setReserveCourseName] = useState('');
  const [pubSemester, setPubSemester] = useState('2024–25 Even Semester');
  const [pubNotes, setPubNotes] = useState('');

  // Procurement Form State
  const [procForm, setProcForm] = useState({ title: '', author: '', isbn: '', reason: '' });

  // Bulk Request State
  const [bulkCopies, setBulkCopies] = useState('30');
  const [bulkLocation, setBulkLocation] = useState('CS Lab A');

  const nav = (sec: string) => setActiveSection(sec);

  // Bind to Firestore
  useEffect(() => {
    if (!user) return;
    const unsubBooks = onSnapshot(collection(db, 'books'), snap => setBooks(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubTx = onSnapshot(collection(db, 'transactions'), snap => setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubRes = onSnapshot(collection(db, 'reserves'), snap => setReserves(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubProc = onSnapshot(collection(db, 'procurements'), snap => setProcurements(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubBulk = onSnapshot(collection(db, 'bulkRequests'), snap => setBulkRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
      const allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllSystemUsers(allUsers);
      const found = allUsers.find((u:any) => u.email === user.email);
      if (found) setSystemUser(found);
    });

    return () => { unsubBooks(); unsubTx(); unsubRes(); unsubProc(); unsubBulk(); unsubUsers(); };
  }, [user]);

  const facultyName = systemUser ? `${systemUser.firstName} ${systemUser.lastName}` : user?.displayName || user?.email?.split('@')[0] || 'Faculty Member';
  const facultyUserId = systemUser?.userId || user?.uid || 'unknown';

  // Derived Values
  const myHoldings = transactions.filter(t => t.userId === facultyUserId && ['Borrowed', 'Overdue'].includes(t.status));
  const myReserves = reserves.filter(r => r.createdBy === facultyUserId);
  const myProcurements = procurements.filter(p => p.createdBy === facultyUserId);
  const myBulkRequests = bulkRequests.filter(b => b.createdBy === facultyUserId);
  
  const filteredBooks = React.useMemo(() => {
    return books.filter(b => {
      const title = b.title || '';
      const author = b.author || '';
      const isbn = b.isbn || '';
      const category = b.category || '';
      const status = b.status || '';

      const matchesSearch = !searchQuery || `${title} ${author} ${isbn}`.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = !catFilter || category === catFilter;
      const matchesAvail = !availFilter || status === availFilter;
      return matchesSearch && matchesCat && matchesAvail;
    });
  }, [books, searchQuery, catFilter, availFilter]);
  
  const totalPages = Math.ceil(filteredBooks.length / booksPerPage);
  const paginatedBooks = filteredBooks.slice((searchPage - 1) * booksPerPage, searchPage * booksPerPage);

  const departmentHoldings = transactions.filter(t => {
    if (!['Borrowed', 'Overdue'].includes(t.status)) return false;
    if (!systemUser?.dept) return true; // If faculty has no dept, show all?
    const txUser = allSystemUsers.find(u => u.userId === t.userId);
    return txUser?.dept === systemUser.dept;
  });

  // Handlers
  const openBookModal = (book: any) => {
    setSelectedBook(book);
    setBookDetailModalOpen(true);
  };

  const handleLogout = async () => {
    try {
      logout();
      toast.success('Logged out successfully');
    } catch (err) {
      toast.error('Failed to log out');
    }
  };

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const addToReserveList = (book: any) => {
    if (reserveDraft.find(r => r.id === book.id)) {
      toast.info('Book is already in the draft list');
      return;
    }
    setReserveDraft([...reserveDraft, book]);
    toast.success(`Added "${book.title}" to Reserve Draft`);
  };

  const publishReserve = async () => {
    if (!reserveCourseName || reserveDraft.length === 0) {
      toast.error('Please enter a course name and add at least one book');
      return;
    }
    try {
      const reserveId = `RES-${Date.now()}`;
      await setDoc(doc(db, 'reserves', reserveId), {
        courseName: reserveCourseName,
        semester: pubSemester,
        notes: pubNotes,
        books: reserveDraft.map(b => ({ id: b.id, title: b.title, author: b.author })),
        createdBy: facultyUserId,
        creatorName: facultyName,
        createdAt: new Date().toISOString(),
        status: 'Active'
      });
      await logAudit('POST', `Faculty published Course Reserve: ${reserveCourseName}`, 200);
      setReserveDraft([]);
      setReserveCourseName('');
      setPublishModalOpen(false);
      toast.success('Course Reserve list published successfully!');
    } catch (err) {
      toast.error('Failed to publish reserve');
    }
  };

  const submitProcurement = async () => {
    if (!procForm.title || !procForm.author || !procForm.reason) {
      toast.error('Title, author, and reason are required');
      return;
    }
    try {
      const procId = `PROC-${Date.now()}`;
      await setDoc(doc(db, 'procurements', procId), {
        ...procForm,
        createdBy: facultyUserId,
        creatorName: facultyName,
        createdAt: new Date().toISOString(),
        status: 'Pending'
      });
      await logAudit('POST', `Faculty requested book procurement: ${procForm.title}`, 200);
      setProcForm({ title: '', author: '', isbn: '', reason: '' });
      toast.success('Procurement request submitted to Librarian/Admin');
    } catch (err) {
      toast.error('Failed to submit request');
    }
  };

  const submitBulkRequest = async () => {
    if (!selectedBook || !bulkCopies) {
      toast.error('Please select a book and specify copies');
      return;
    }
    try {
      const bulkId = `BLK-${Date.now()}`;
      await setDoc(doc(db, 'bulkRequests', bulkId), {
        bookId: selectedBook.id,
        bookTitle: selectedBook.title,
        copies: bulkCopies,
        location: bulkLocation,
        createdBy: facultyUserId,
        creatorName: facultyName,
        createdAt: new Date().toISOString(),
        status: 'Pending'
      });
      await logAudit('POST', `Faculty requested Bulk Issue for: ${selectedBook.title}`, 200);
      setBulkModalOpen(false);
      toast.success('Bulk issue request submitted to Librarian');
    } catch (err) {
      toast.error('Failed to submit bulk request');
    }
  };

  const sectionTitleMap: Record<string, string> = {
    'dashboard': 'Research Hub',
    'search': 'Catalog Search',
    'reserves': 'Course Reserves',
    'bulk': 'Bulk Issue',
    'department': 'Department Holdings',
    'procurement': 'Request Purchase'
  };

  return (
    <>
      <div className="toast-wrap" id="toastWrap"></div>
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />

      {/* ═══════════ MODALS ═══════════ */}
      {bookDetailModalOpen && selectedBook && (
        <div className="ovl open" onClick={(e) => { if (e.target === e.currentTarget) setBookDetailModalOpen(false); }}>
          <div className="modal modal-lg">
            <div className="mhdr">
              <h3>Book Details</h3>
              <button className="mcls" onClick={() => setBookDetailModalOpen(false)}>✕</button>
            </div>
            <div className="mbdy">
               <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ width: '80px', height: '106px', borderRadius: '8px', background: 'var(--cream-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>📖</div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-d)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--ink)' }}>{selectedBook.title}</div>
                    <div style={{ color: 'var(--smoke)' }}>By {selectedBook.author}</div>
                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                      <span className="pill p-ink">{selectedBook.category || 'Textbook'}</span>
                      <span className={`pill ${selectedBook.availCopies > 0 ? 'p-green' : 'p-red'}`}>{selectedBook.availCopies > 0 ? 'Available' : 'Out of Stock'}</span>
                    </div>
                  </div>
               </div>
            </div>
            <div className="mftr">
              <button className="btn btn-outline" onClick={() => setBookDetailModalOpen(false)}>Close</button>
              <button className="btn btn-purple" onClick={() => { addToReserveList(selectedBook); setBookDetailModalOpen(false); }}>📌 Add to Reserve Draft</button>
            </div>
          </div>
        </div>
      )}

      {bulkModalOpen && selectedBook && (
        <div className="ovl open" onClick={(e) => { if (e.target === e.currentTarget) setBulkModalOpen(false); }}>
          <div className="modal">
            <div className="mhdr">
              <h3>📦 Confirm Bulk Issue</h3>
              <button className="mcls" onClick={() => setBulkModalOpen(false)}>✕</button>
            </div>
            <div className="mbdy">
              <div style={{ background: 'var(--P-bg)', padding: '16px', borderRadius: 'var(--r-md)', marginBottom: '16px', border: '1px solid rgba(109,40,217,0.1)' }}>
                <div style={{ fontWeight: 700, color: 'var(--P600)' }}>{selectedBook.title}</div>
                <div style={{ fontSize: '14px', color: 'var(--smoke)' }}>Requested: {bulkCopies} copies to {bulkLocation}</div>
              </div>
              <p style={{ fontSize: '14px', color: 'var(--smoke)' }}>This request will notify the Librarian for provisioning.</p>
            </div>
            <div className="mftr">
              <button className="btn btn-outline" onClick={() => setBulkModalOpen(false)}>Cancel</button>
              <button className="btn btn-purple" onClick={submitBulkRequest}>✅ Submit to Librarian</button>
            </div>
          </div>
        </div>
      )}

      {publishModalOpen && (
        <div className="ovl open" onClick={(e) => { if (e.target === e.currentTarget) setPublishModalOpen(false); }}>
          <div className="modal">
            <div className="mhdr">
              <h3>📢 Publish Course Reserve</h3>
              <button className="mcls" onClick={() => setPublishModalOpen(false)}>✕</button>
            </div>
            <div className="mbdy">
              <div className="fg">
                <label className="flbl">Course Name <span>*</span></label>
                <input className="fc" value={reserveCourseName} onChange={e => setReserveCourseName(e.target.value)} placeholder="e.g. Intro to CS101" />
              </div>
              <div className="fg">
                <label className="flbl">Semester / Session</label>
                <select className="fc" value={pubSemester} onChange={e => setPubSemester(e.target.value)}>
                  <option>2024–25 Odd Semester</option>
                  <option>2024–25 Even Semester</option>
                  <option>2025–26 Odd Semester</option>
                </select>
              </div>
              <div className="fg">
                <label className="flbl">Notes to Students</label>
                <textarea className="fc" rows={2} value={pubNotes} onChange={e => setPubNotes(e.target.value)} placeholder="Optional message..."></textarea>
              </div>
            </div>
            <div className="mftr">
              <button className="btn btn-outline" onClick={() => setPublishModalOpen(false)}>Cancel</button>
              <button className="btn btn-purple" onClick={publishReserve}>📢 Publish List</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ APP SHELL ═══════════ */}
      <div className="app">
        <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="sb-head">
             <div className="sb-logo">📖</div>
             <div className="sb-brand">Vemu Library<small>Faculty Portal</small></div>
             <button className="sb-toggle" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>❮</button>
          </div>
          <nav className="sb-nav">
            <div className="sb-grp">App</div>
            <div className={`sb-item ${activeSection === 'dashboard' ? 'active' : ''}`} onClick={() => nav('dashboard')} data-tip="Research Hub">
              <div className="ico">🏠</div> <span className="lbl">Research Hub</span>
            </div>
            <div className={`sb-item ${activeSection === 'search' ? 'active' : ''}`} onClick={() => nav('search')} data-tip="Catalog Search">
              <div className="ico">🔍</div> <span className="lbl">Catalog Search</span>
            </div>
            
            <div className="sb-grp" style={{ marginTop: '16px' }}>Curation</div>
            <div className={`sb-item ${activeSection === 'reserves' ? 'active' : ''}`} onClick={() => nav('reserves')} data-tip="Course Reserves">
              <div className="ico">📚</div> <span className="lbl">Course Reserves</span>
            </div>
            <div className={`sb-item ${activeSection === 'bulk' ? 'active' : ''}`} onClick={() => nav('bulk')} data-tip="Bulk Issue">
              <div className="ico">📦</div> <span className="lbl">Bulk Issue</span>
            </div>

            <div className="sb-grp" style={{ marginTop: '16px' }}>Department</div>
            <div className={`sb-item ${activeSection === 'department' ? 'active' : ''}`} onClick={() => nav('department')} data-tip="Dept Holdings">
              <div className="ico">🏛️</div> <span className="lbl">Dept Holdings</span>
            </div>
            <div className={`sb-item ${activeSection === 'procurement' ? 'active' : ''}`} onClick={() => nav('procurement')} data-tip="Request Purchase">
              <div className="ico">🛒</div> <span className="lbl">Request Purchase</span>
            </div>
          </nav>
          <div className="sb-foot">
            <div className="sb-user" onClick={() => setIsProfileModalOpen(true)}>
               <div className="sb-av">{facultyName.charAt(0).toUpperCase()}</div>
               <div className="sb-uinfo">
                 <div className="sb-uname">{facultyName}</div>
                 <div className="sb-urole">Faculty</div>
               </div>
            </div>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <div className="topbar-left">
               <div className="topbar-ttl">
                 <div className="topbar-icon">{activeSection === 'dashboard' ? '🏠' : activeSection === 'search' ? '🔍' : activeSection === 'reserves' ? '📚' : activeSection === 'bulk' ? '📦' : activeSection === 'department' ? '🏛️' : '🛒'}</div>
                 <div className="topbar-copy">
                   <div className="topbar-title">{sectionTitleMap[activeSection]}</div>
                   <div className="topbar-bc">Faculty / {sectionTitleMap[activeSection]}</div>
                 </div>
               </div>
            </div>
            <div className="topbar-right">
              <NotificationBell />
              <button 
                onClick={handleLogout}
                className="btn btn-outline"
                style={{ marginLeft: '8px', padding: '6px 12px' }}
              >
                <span>🚪</span> <span className="hide-on-mobile">Logout</span>
              </button>
            </div>
          </header>

          <div className="content">

            {/* DASHBOARD */}
            <section className={`section ${activeSection === 'dashboard' ? 'active' : ''}`}>
              <div className="priv-bar">
                <span className="text-xl">🎓</span>
                <div>
                  <strong>Faculty Privileges Active:</strong> 180-day borrowing period automatically applied. Fine exemption is active. Connected natively to Firebase.
                </div>
              </div>

              <div className="stat-row">
                <div className="scard">
                   <div className="scard-top">
                     <div className="scard-ico" style={{background: 'var(--P-bg)', color: 'var(--P500)'}}>📚</div>
                   </div>
                   <div className="scard-num">{myHoldings.length}</div>
                   <div className="scard-lbl">Live Issued</div>
                </div>
                <div className="scard">
                   <div className="scard-top">
                     <div className="scard-ico" style={{background: 'var(--teal-bg)', color: 'var(--teal)'}}>📋</div>
                   </div>
                   <div className="scard-num">{myReserves.length}</div>
                   <div className="scard-lbl">Published Reserves</div>
                </div>
                <div className="scard">
                   <div className="scard-top">
                     <div className="scard-ico" style={{background: 'var(--amber-bg)', color: 'var(--amber)'}}>🛒</div>
                   </div>
                   <div className="scard-num">{myProcurements.length}</div>
                   <div className="scard-lbl">Procurement Requests</div>
                </div>
                <div className="scard">
                   <div className="scard-top">
                     <div className="scard-ico" style={{background: 'var(--blue-bg)', color: 'var(--blue)'}}>📖</div>
                   </div>
                   <div className="scard-num">{books.length}</div>
                   <div className="scard-lbl">Catalog Titles</div>
                </div>
              </div>

              <div className="g2">
                <div className="card">
                  <div className="card-hdr">
                    <div>
                      <h3 className="card-ttl">My Research Bookshelf</h3>
                      <div className="card-sub">Currently borrowed titles</div>
                    </div>
                  </div>
                  <div className="card-body">
                     {myHoldings.length === 0 ? <div className="text-center text-[0.8rem] text-[var(--smoke)] py-6">No active loans. Books issued by librarian will appear natively here.</div> :
                        <div className="bookshelf-grid">
                        {myHoldings.map(t => (
                          <div key={t.id} className="bk-card">
                             <div className="bk-spine" style={{ background: t.status === 'Overdue' ? 'var(--red)' : 'var(--P400)' }}></div>
                             <div className="bk-body">
                               <div className="bk-title">{t.bookTitle}</div>
                               <div className="bk-author">Due: {t.due}</div>
                               <div className="bk-meta">
                                 <span className={`pill ${t.status==='Overdue'?'p-red':'p-green'}`}>{t.status}</span>
                               </div>
                             </div>
                          </div>
                        ))}
                        </div>
                     }
                  </div>
                </div>

                <div className="card">
                  <div className="card-hdr">
                    <h3 className="card-ttl">Quick Actions</h3>
                  </div>
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button className="btn" style={{ justifyContent: 'flex-start', padding: '16px', background: 'var(--P-bg)', color: 'var(--P700)', border: '1px solid rgba(109,40,217,0.1)' }} onClick={() => nav('reserves')}>
                       <span style={{ fontSize: '1.2rem' }}>📚</span> Create Course Reserve List
                    </button>
                    <button className="btn" style={{ justifyContent: 'flex-start', padding: '16px', background: 'var(--cream)', color: 'var(--ink)', border: '1px solid var(--border)' }} onClick={() => nav('procurement')}>
                       <span style={{ fontSize: '1.2rem' }}>🛒</span> Request Book Purchase
                    </button>
                    <button className="btn" style={{ justifyContent: 'flex-start', padding: '16px', background: 'var(--cream)', color: 'var(--ink)', border: '1px solid var(--border)' }} onClick={() => nav('bulk')}>
                       <span style={{ fontSize: '1.2rem' }}>📦</span> Submit Bulk Issue Request
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* SEARCH */}
            <section className={`section ${activeSection === 'search' ? 'active' : ''}`}>
              <div className="sec-hdr">
                <div>
                  <h2>Catalog Search</h2>
                  <p>Browse the entire library database directly.</p>
                </div>
              </div>

              <div className="toolbar">
                <div className="sf" style={{ maxWidth: '400px' }}>
                  <span className="si">🔍</span>
                  <input
                    placeholder="Search by title, author, or ISBN…"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setSearchPage(1); }}
                  />
                </div>
                <select className="fsel" value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setSearchPage(1); }}>
                  <option value="">All Categories</option>
                  <option>Computer Science</option>
                  <option>Electronics</option>
                  <option>Mathematics</option>
                  <option>Management</option>
                  <option>Physics</option>
                  <option>General Fiction</option>
                  <option>Mechanical</option>
                </select>
                <select className="fsel" value={availFilter} onChange={(e) => { setAvailFilter(e.target.value); setSearchPage(1); }}>
                  <option value="">All Status</option>
                  <option value="Available">Available</option>
                  <option value="Loaned">Loaned Out</option>
                  <option value="Archived">Archived</option>
                  <option value="Lost">Lost</option>
                </select>
                <span style={{ fontSize: '.8rem', color: 'var(--smoke)', marginLeft: '4px' }}>
                  {filteredBooks.length} books
                </span>
              </div>

              <div className="card">
                <div className="tbl-wrap">
                  <table className="dtbl">
                    <thead>
                      <tr>
                        <th>Book</th>
                        <th>ISBN</th>
                        <th>Category</th>
                        <th>Copies</th>
                        <th>Available</th>
                        <th>Location</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedBooks.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--smoke)' }}>
                            No books match your criteria.
                          </td>
                        </tr>
                      ) : (
                        paginatedBooks.map((b: any, index: number) => {
                          const avPct = b.totalCopies ? Math.round((b.availCopies / b.totalCopies) * 100) : 0;
                          const isZero = b.availCopies === 0;
                          const colorIndex = (b.id.length || index) % 8;
                          const colorHex = COLORS[colorIndex];
                          const sStatus = b.status || (isZero ? 'Loaned' : 'Available');

                          return (
                            <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => openBookModal(b)}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div
                                    style={{
                                      background: `${colorHex}22`,
                                      color: colorHex,
                                      width: '36px',
                                      height: '48px',
                                      borderRadius: '4px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '1.2rem',
                                      flexShrink: 0
                                    }}
                                  >
                                    📖
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: '.85rem', color: 'var(--ink)', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {b.title}
                                    </div>
                                    <div style={{ fontSize: '.73rem', color: 'var(--smoke)' }}>
                                      {b.author} {b.year ? `· ${b.year}` : ''}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ fontFamily: 'var(--font-m)', fontSize: '.72rem', color: 'var(--charcoal)' }}>{b.isbn || '-'}</td>
                              <td><span className="pill p-purple" style={{ fontSize: '.66rem' }}>{b.category || 'Unknown'}</span></td>
                              <td style={{ fontSize: '.85rem', textAlign: 'center' }}>{b.totalCopies}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '.85rem', fontWeight: 600, color: isZero ? 'var(--red)' : 'var(--green)' }}>
                                    {b.availCopies}
                                  </span>
                                  <div style={{ width: '40px', height: '4px', background: 'var(--border-2)', borderRadius: '99px', overflow: 'hidden' }}>
                                    <div
                                      style={{ width: `${avPct}%`, height: '100%', background: isZero ? 'var(--red)' : 'var(--green)', borderRadius: '99px' }}
                                    ></div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ fontFamily: 'var(--font-m)', fontSize: '.75rem', color: 'var(--charcoal)' }}>{b.location || '-'}</td>
                              <td>
                                <span className={`pill ${sStatus === 'Available' ? 'p-green' : sStatus === 'Lost' ? 'p-red' : 'p-amber'}`}>
                                  {sStatus}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                  <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); openBookModal(b); }}>Details</button>
                                  <button className="btn btn-purple btn-sm" onClick={(e) => { e.stopPropagation(); addToReserveList(b); }}>Draft</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="card-foot" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '.78rem', color: 'var(--smoke)' }}>
                    Showing {filteredBooks.length === 0 ? 0 : (searchPage - 1) * booksPerPage + 1}–{Math.min(searchPage * booksPerPage, filteredBooks.length)} of {filteredBooks.length} books
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button 
                      className="btn btn-outline btn-sm" 
                      disabled={searchPage === 1} 
                      onClick={() => setSearchPage(searchPage - 1)}
                      style={{ minWidth: '32px', padding: '4px' }}
                    >‹</button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button 
                        key={p} 
                        className={`btn btn-sm ${p === searchPage ? 'btn-purple' : 'btn-outline'}`} 
                        onClick={() => setSearchPage(p)}
                        style={{ minWidth: '32px', padding: '4px' }}
                      >{p}</button>
                    ))}
                    <button 
                      className="btn btn-outline btn-sm" 
                      disabled={searchPage === totalPages || totalPages === 0} 
                      onClick={() => setSearchPage(searchPage + 1)}
                      style={{ minWidth: '32px', padding: '4px' }}
                    >›</button>
                  </div>
                </div>
              </div>
            </section>

            {/* COURSE RESERVES */}
            <section className={`section ${activeSection === 'reserves' ? 'active' : ''}`}>
              <div className="sec-hdr">
                <div>
                  <h2>Course Reserves</h2>
                  <p>Build and publish required reading lists for your students.</p>
                </div>
              </div>

              <div className="reserves-split mb-8" style={{ marginBottom: '30px' }}>
                <div className="reserve-panel flex flex-col">
                  <div className="rp-head">
                    <h3>Search & Add</h3>
                  </div>
                  <div className="rp-body" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="sf" style={{ marginBottom: '14px', flex: 'none' }}>
                      <span className="si">🔍</span>
                      <input placeholder="Quick search catalog..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} />
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                       {filteredBooks.slice(0, 10).map((b:any) => (
                         <div key={b.id} className="search-book-item" onClick={() => addToReserveList(b)}>
                            <div className="sbi-cover" style={{ background: 'var(--P-bg)', color: 'var(--P500)' }}>📖</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="sbi-title">{b.title}</div>
                              <div className="sbi-auth">{b.author}</div>
                            </div>
                            <div className="sbi-add">＋</div>
                         </div>
                       ))}
                    </div>
                  </div>
                </div>

                <div className="reserve-panel flex flex-col">
                  <div className="rp-head">
                    <div>
                      <h3>📝 Draft Reserve List</h3>
                      <div className="card-sub">{reserveDraft.length} items queued</div>
                    </div>
                    {reserveDraft.length > 0 && <button className="btn btn-purple btn-sm" onClick={() => setPublishModalOpen(true)}>📢 Publish</button>}
                  </div>

                  <div className="rp-body" style={{ background: 'var(--parchment)' }}>
                    {reserveDraft.length === 0 ? (
                      <div className="drop-zone" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="drop-zone-icon">📚</div>
                        <div style={{fontWeight: 700, color: 'var(--charcoal)', marginBottom: '4px'}}>List Empty</div>
                        <div className="drop-zone-txt">Search and add books from the catalog panel on the left to start building your reserve list.</div>
                      </div>
                    ) : (
                      <div>
                        {reserveDraft.map((b, i) => (
                           <div className="reserve-slot" key={b.id}>
                             <div className="rs-num">{i+1}</div>
                             <div className="rs-title">{b.title}</div>
                             <button className="rs-remove" onClick={() => setReserveDraft(prev => prev.filter(x => x.id !== b.id))}>✕</button>
                           </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="card mt-6">
                <div className="card-hdr mb-4">
                   <h3 className="card-ttl">📋 My Published Lists</h3>
                </div>
                <div className="tbl-wrap">
                  <table className="dtbl">
                    <thead>
                       <tr><th>Course</th><th>Items</th><th>Semester</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {myReserves.length === 0 ? <tr><td colSpan={4} style={{textAlign:'center', padding: '30px', color: 'var(--smoke)'}}>You haven't published any reserve lists yet.</td></tr> : 
                        myReserves.map(r => (
                          <tr key={r.id}>
                             <td><strong style={{color: 'var(--ink)'}}>{r.courseName}</strong></td>
                             <td style={{fontFamily: 'var(--font-m)', color: 'var(--P600)', fontWeight: 700}}>{r.books?.length || 0}</td>
                             <td style={{color: 'var(--smoke)'}}>{r.semester}</td>
                             <td><span className="pill p-green">{r.status}</span></td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* DEPARTMENT HOLDINGS */}
            <section className={`section ${activeSection === 'department' ? 'active' : ''}`}>
              <div className="sec-hdr">
                <div>
                  <h2>Department Holdings</h2>
                  <p>All active circulations in your department.</p>
                </div>
              </div>
              <div className="card">
                <div className="tbl-wrap">
                  <table className="dtbl">
                    <thead>
                       <tr><th>Book</th><th>Holder ID</th><th>Due</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {departmentHoldings.length === 0 ? <tr><td colSpan={4} style={{textAlign:'center', padding: '30px', color: 'var(--smoke)'}}>No active circulation globally.</td></tr> : 
                        departmentHoldings.map(t => (
                          <tr key={t.id}>
                             <td><strong style={{color: 'var(--ink)'}}>{t.bookTitle}</strong></td>
                             <td style={{fontFamily: 'var(--font-m)', color: 'var(--smoke)'}}>{t.userId}</td>
                             <td style={{fontFamily: 'var(--font-m)', fontWeight: 600, color: t.status === 'Overdue' ? 'var(--red)' : 'var(--ink)'}}>{t.due}</td>
                             <td><span className={`pill ${t.status==='Overdue'?'p-red':'p-purple'}`}>{t.status}</span></td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* PROCUREMENT */}
            <section className={`section ${activeSection === 'procurement' ? 'active' : ''}`}>
               <div className="sec-hdr">
                <div>
                  <h2>Request Purchase</h2>
                  <p>Suggest a book to be added to the library.</p>
                </div>
              </div>
              
              <div className="g2">
                <div className="proc-form">
                  <h3>Request New Book</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
                    <div className="fg">
                      <label className="flbl">Book Title <span>*</span></label>
                      <input className="fc" value={procForm.title} onChange={e=>setProcForm({...procForm, title: e.target.value})} />
                    </div>
                    <div className="fg">
                      <label className="flbl">Author(s) <span>*</span></label>
                      <input className="fc" value={procForm.author} onChange={e=>setProcForm({...procForm, author: e.target.value})} />
                    </div>
                    <div className="fg">
                      <label className="flbl">ISBN / Details</label>
                      <input className="fc" value={procForm.isbn} onChange={e=>setProcForm({...procForm, isbn: e.target.value})} />
                    </div>
                    <div className="fg">
                      <label className="flbl">Reason for Request <span>*</span></label>
                      <textarea className="fc" rows={3} value={procForm.reason} onChange={e=>setProcForm({...procForm, reason: e.target.value})} />
                    </div>
                    <button className="btn btn-purple btn-lg" style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }} onClick={submitProcurement}>Submit Procurement Request</button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="card">
                     <div className="card-hdr mb-2"><h3 className="card-ttl">My Requests</h3></div>
                     <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '0' }}>
                       {myProcurements.length === 0 ? <div style={{ border: '1px dashed var(--border-2)', padding: '20px', textAlign: 'center', color: 'var(--smoke)', borderRadius: 'var(--r-md)', fontSize: '0.8rem' }}>No procurement requests yet.</div> :
                         myProcurements.map(p => (
                           <div key={p.id} style={{ padding: '14px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--paper)' }}>
                             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}><div style={{ fontWeight: 700, color: 'var(--ink)' }}>{p.title}</div><span className="pill p-amber">{p.status}</span></div>
                             <div style={{ fontSize: '0.7rem', color: 'var(--smoke)', marginBottom: '8px' }}>By {p.author}</div>
                             <div style={{ fontSize: '0.8rem', color: 'var(--charcoal)' }}>{p.reason}</div>
                           </div>
                         ))
                       }
                     </div>
                  </div>
                  
                  <div className="priv-bar" style={{ background: 'var(--blue-bg)', borderColor: 'rgba(37, 99, 235, 0.2)', color: 'var(--blue)', alignItems: 'flex-start', padding: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <h4 style={{ fontWeight: 700, fontSize: '0.85rem' }}>📜 Procurement Workflow</h4>
                      <ul style={{ fontSize: '0.75rem', opacity: 0.9, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <li>Requests are directly synchronized with the Admin and Librarian dashboards</li>
                        <li>Approval flow: Faculty → Librarian Desk → Final Admin Budgeting</li>
                        <li>Status will automatically update here when approved or procured</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* BULK ISSUE */}
            <section className={`section ${activeSection === 'bulk' ? 'active' : ''}`}>
               <div className="sec-hdr">
                <div>
                  <h2>Bulk Issue Request</h2>
                  <p>Request multiple copies for a lab or classroom.</p>
                </div>
              </div>

              <div className="bulk-split">
                <div className="card flex flex-col">
                  <div className="card-hdr" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border)', background: 'var(--cream)' }}>
                    <div style={{ width: '100%' }}>
                      <h3 className="card-ttl mb-2">📖 1. Select Book From Catalog</h3>
                      <div className="sf" style={{ width: '100%' }}>
                        <span className="si">🔍</span>
                        <input placeholder="Search catalog..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <div className="card-body" style={{ flex: 1, overflowY: 'auto', maxHeight: '400px', padding: '12px' }}>
                     {filteredBooks.slice(0, 15).map((b:any) => (
                       <div key={b.id} className={`class-item ${selectedBook?.id === b.id ? 'selected' : ''}`} onClick={() => setSelectedBook(b)} style={{ marginBottom: '8px', justifyContent: 'space-between' }}>
                          <div><div style={{ fontWeight: 700, marginBottom: '2px' }}>{b.title}</div><div style={{ fontSize: '0.7rem', opacity: 0.8 }}>Available copies: {b.availCopies ?? b.totalCopies}</div></div>
                          {selectedBook?.id === b.id && <div style={{ fontSize: '0.7rem', fontWeight: 700 }}>✓ Selected</div>}
                       </div>
                     ))}
                  </div>
                </div>

                <div className="card flex flex-col">
                  <div className="card-hdr"><h3 className="card-ttl">📦 2. Configure Request</h3></div>
                  <div className="card-body">
                    {selectedBook ? (
                      <div className="fg" style={{ gap: '16px' }}>
                        <div style={{ padding: '14px', background: 'var(--P-bg)', border: '1px solid rgba(109,40,217,0.1)', borderRadius: 'var(--r-md)' }}>
                           <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--P400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Target Book</div>
                           <div style={{ fontWeight: 700, color: 'var(--P700)' }}>{selectedBook.title}</div>
                        </div>
                        <div className="fg">
                          <label className="flbl">Copies Required <span>*</span></label>
                          <input className="fc" type="number" min="1" value={bulkCopies} onChange={e=>setBulkCopies(e.target.value)} />
                        </div>
                        <div className="fg">
                          <label className="flbl">Target Location <span>*</span></label>
                          <select className="fc" value={bulkLocation} onChange={e=>setBulkLocation(e.target.value)}>
                            <option>CS Lab A – Block 3, Room 101</option>
                            <option>CS Lab B – Block 3, Room 102</option>
                            <option>Main Reading Room</option>
                            <option>Faculty Office – CSE Dept</option>
                          </select>
                        </div>
                        <button className="btn btn-purple btn-lg" style={{ marginTop: '8px', justifyContent: 'center' }} onClick={() => setBulkModalOpen(true)}>Create Bulk Request</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', color: 'var(--smoke)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                        Select a book from the panel on the left to continue.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="card mt-6">
                <div className="card-hdr mb-3"><h3 className="card-ttl">My Bulk History</h3></div>
                <div className="tbl-wrap">
                  <table className="dtbl">
                    <thead>
                      <tr><th>Book</th><th>Details</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {myBulkRequests.length === 0 ? <tr><td colSpan={3} style={{textAlign:'center', padding: '30px', color: 'var(--smoke)'}}>No active bulk requests.</td></tr> : 
                        myBulkRequests.map(r => (
                          <tr key={r.id}>
                             <td><strong style={{color: 'var(--ink)'}}>{r.bookTitle}</strong></td>
                             <td style={{color: 'var(--smoke)'}}>{r.copies} copies to {r.location}</td>
                             <td><span className="pill p-amber">{r.status}</span></td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

          </div>{/* /content */}
        </div>{/* /main */}
      </div>{/* /app */}
    </>
  );
}
