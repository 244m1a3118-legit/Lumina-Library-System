import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { db } from '../../lib/firebase';
import { logAudit } from '../../lib/audit';
import { collection, onSnapshot, doc, updateDoc, setDoc, getDocs } from '@/src/lib/dbClient';



const statusPillMap: Record<string, string> = { 
  Returned: 'pill-green', 
  Borrowed: 'pill-blue', 
  Overdue: 'pill-red', 
  Lost: 'pill-red' 
};

export const TransactionManagement: React.FC = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [books, setBooks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    userId: '',
    bookId: '',
    checkout: new Date().toISOString().split('T')[0],
    due: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  const txPerPage = 8;

  useEffect(() => {
    // We can use getDocs or onSnapshot. Since we want real-time futurism, let's use onSnapshot for transactions at least
    const fetchBooksAndUsers = async () => {
      try {
        const [booksSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, 'books')),
          getDocs(collection(db, 'users'))
        ]);
        setBooks(booksSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      }
    };
    
    fetchBooksAndUsers();

    const unsubTx = onSnapshot(collection(db, 'transactions'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort newest first
      data.sort((a: any, b: any) => new Date(b.checkout).getTime() - new Date(a.checkout).getTime());
      setTransactions(data);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubTx();
  }, []);

  const handleIssueBookSubmit = async () => {
    if (!formData.userId || !formData.bookId) {
      toast.error('Please select both user and book.');
      return;
    }

    const user = users.find(u => u.userId === formData.userId);
    const book = books.find(b => String(b.id) === String(formData.bookId));

    if (!user || !book) {
      toast.error('Invalid user or book selection.');
      return;
    }

    if (book.availCopies === 0) {
      toast.error('No copies available for this book.');
      return;
    }

    try {
      const txId = `TXN-${Date.now()}`;
      await setDoc(doc(db, 'transactions', txId), {
        userId: user.userId,
        userName: `${user.firstName} ${user.lastName}`,
        bookId: book.id,
        bookTitle: book.title,
        checkout: formData.checkout,
        due: formData.due,
        status: 'Borrowed',
        fine: 0,
        fineStatus: 'None',
        renewalCount: 0
      });

      // Update book stock
      await updateDoc(doc(db, 'books', book.id), {
        availCopies: book.availCopies - 1,
        status: book.availCopies - 1 === 0 ? 'Loaned' : 'Available'
      });

      await logAudit('POST', `Issued ${book.title} to ${user.firstName}`, 200);

      toast.success('Book issued successfully!');
      setModalOpen(false);
      
      // Refresh local books list to update dropdown immediate availability
      const updatedBooks = [...books];
      const index = updatedBooks.findIndex(b => b.id === book.id);
      if (index !== -1) {
        updatedBooks[index].availCopies -= 1;
        setBooks(updatedBooks);
      }
    } catch (err) {
      toast.error('Transaction failed.');
      console.error(err);
    }
  };

  const filteredTx = useMemo(() => {
    return transactions.filter(t => {
      const userName = t.userName || '';
      const bookTitle = t.bookTitle || '';
      const status = t.status || '';

      const matchesSearch = !search || `${userName} ${bookTitle} ${t.id}`.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = !statusFilter || status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [transactions, search, statusFilter]);

  const totalPages = Math.ceil(filteredTx.length / txPerPage);
  const paginatedTx = filteredTx.slice((page - 1) * txPerPage, page * txPerPage);

  const handleIssueBook = () => {
    setModalOpen(true);
  };

  return (
    <section className="section active" id="sec-transactions">
      <div className="section-header">
        <div>
          <h2>Transactions</h2>
          <p>Manage book loans, returns, and fine collections</p>
        </div>
        <button className="btn btn-primary" onClick={handleIssueBook}>＋ Issue New Book</button>
      </div>

      <div className="toolbar">
        <div className="search-field">
          <span className="ico">🔍</span>
          <input 
            type="text" 
            placeholder="Search by user, book, or TXN ID…" 
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="filter-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="Borrowed">Borrowed</option>
          <option value="Returned">Returned</option>
          <option value="Overdue">Overdue</option>
          <option value="Lost">Lost</option>
        </select>
        <span style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
          {filteredTx.length} records
        </span>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>TXN ID</th>
                <th>User</th>
                <th>Book Title</th>
                <th>Checkout</th>
                <th>Due Date</th>
                <th>Returned</th>
                <th>Fine</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '20px' }}>Loading transactions...</td>
                </tr>
              ) : paginatedTx.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <div className="es-icon">🔄</div>
                      <p>No transactions match your filter.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedTx.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '.75rem', color: 'var(--navy)' }}>{t.id}</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '.83rem' }}>{t.userName}</div>
                      <div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>{t.userId}</div>
                    </td>
                    <td style={{ fontSize: '.82rem', maxWidth: '160px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.bookTitle}
                    </td>
                    <td style={{ fontSize: '.78rem', color: 'var(--text-sec)' }}>{t.checkout}</td>
                    <td style={{ 
                      fontSize: '.78rem', 
                      color: t.status === 'Overdue' ? 'var(--red)' : 'var(--text-sec)',
                      fontWeight: t.status === 'Overdue' ? 700 : 400 
                    }}>
                      {t.due}
                    </td>
                    <td style={{ fontSize: '.78rem', color: 'var(--text-sec)' }}>{t.returned || '—'}</td>
                    <td style={{ fontWeight: 700, color: t.fine > 0 ? 'var(--red)' : 'var(--green)' }}>
                      ₹{t.fine || 0}
                    </td>
                    <td><span className={`status-pill ${statusPillMap[t.status] || 'pill-navy'}`}>{t.status}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="card-footer">
          <span style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>
            Showing {filteredTx.length === 0 ? 0 : (page - 1) * txPerPage + 1}–{Math.min(page * txPerPage, filteredTx.length)} of {filteredTx.length} records
          </span>
          <div style={{ marginLeft: 'auto' }} className="pagination">
            <button className="page-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button className="page-btn" disabled={page === totalPages || totalPages === 0} onClick={() => setPage(page + 1)}>›</button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="overlay open" onClick={() => setModalOpen(false)}>
          <div className="modal modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Issue New Book</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Select User *</label>
                <select className="form-control" value={formData.userId} onChange={e => setFormData({...formData, userId: e.target.value})}>
                  <option value="">-- Search User --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.userId}>{u.firstName} {u.lastName} ({u.userId})</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="form-label">Select Book *</label>
                <select className="form-control" value={formData.bookId} onChange={e => setFormData({...formData, bookId: e.target.value})}>
                  <option value="">-- Search Book --</option>
                  {books.filter(b => b.availCopies > 0).map(b => (
                    <option key={b.id} value={b.id}>{b.title} ({b.availCopies} left)</option>
                  ))}
                </select>
              </div>
              <div className="form-row" style={{ marginTop: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Checkout Date</label>
                  <input className="form-control" type="date" value={formData.checkout} onChange={e => setFormData({...formData, checkout: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input className="form-control" type="date" value={formData.due} onChange={e => setFormData({...formData, due: e.target.value})} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleIssueBookSubmit}>⚡ Confirm Loan</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
