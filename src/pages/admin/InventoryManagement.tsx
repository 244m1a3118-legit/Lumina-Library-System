import React, { useState, useMemo, useEffect } from 'react';
import { COLORS } from '../../lib/constants';
import { toast } from 'sonner';
import { db } from '../../lib/firebase';
import { logAudit } from '../../lib/audit';
import { collection, onSnapshot, doc, deleteDoc, updateDoc, setDoc, getDocs, query, where } from '@/src/lib/dbClient';



const statusPillMap: Record<string, string> = { 
  Available: 'pill-green', 
  Loaned: 'pill-amber', 
  Lost: 'pill-red',
  Archived: 'pill-navy'
};

export const InventoryManagement: React.FC = () => {
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [availFilter, setAvailFilter] = useState('');
  const [page, setPage] = useState(1);
  
  // Modal State
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [bookTransactions, setBookTransactions] = useState<any[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '', author: '', isbn: '', category: 'Computer Science', 
    year: new Date().getFullYear().toString(), totalCopies: 1, availCopies: 1, location: ''
  });

  const booksPerPage = 8;
  
  const resetForm = (book: any = null) => {
    if (book) {
      setFormData({
        title: book.title, author: book.author, isbn: book.isbn,
        category: book.category, year: book.year, totalCopies: book.totalCopies,
        availCopies: book.availCopies, location: book.location
      });
    } else {
      setFormData({
        title: '', author: '', isbn: '', category: 'Computer Science',
        year: new Date().getFullYear().toString(), totalCopies: 1, availCopies: 1, location: ''
      });
    }
  };

  const handleSaveBook = async () => {
    if (!formData.title || !formData.author || !formData.isbn) {
      toast.error('Required fields missing.');
      return;
    }
    
    try {
      const bookData = {
        ...formData,
        totalCopies: Number(formData.totalCopies),
        availCopies: Number(formData.availCopies),
        status: Number(formData.availCopies) > 0 ? 'Available' : 'Loaned',
        archived: false
      };
      
      if (editModalOpen && selectedBook) {
        await updateDoc(doc(db, 'books', selectedBook.id), bookData);
        await logAudit('PATCH', `Updated book: ${bookData.title}`, 200);
        toast.success('Book updated!');
      } else {
        const newId = `book-${Date.now()}`;
        await setDoc(doc(db, 'books', newId), bookData);
        await logAudit('POST', `Added new book to catalog: ${bookData.title}`, 200);
        toast.success('Book added to catalog!');
      }
      
      setAddModalOpen(false);
      setEditModalOpen(false);
      setSelectedBook(null);
    } catch (err) {
      toast.error('Failed to save book.');
      console.error(err);
    }
  };

  const handleDeleteBook = async (id: string) => {
    if (window.confirm('Are you sure you want to remove this book from the catalog?')) {
      try {
        const b = books.find(x => x.id === id);
        await deleteDoc(doc(db, 'books', id));
        await logAudit('DELETE', `Deleted book: ${b?.title || id}`, 200);
        toast.success('Book removed.');
      } catch (err) {
        toast.error('Delete failed.');
      }
    }
  };

  const handleViewBook = (book: any) => {
    setSelectedBook(book);
    getDocs(query(collection(db, 'transactions'), where('bookId', '==', book.id))).then(snap => {
      const txData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setBookTransactions(txData);
    });
  };

  const handleCloseModal = () => {
    setSelectedBook(null);
    setBookTransactions([]);
  };

  const handleEditBook = (e: React.MouseEvent, book: any) => {
    e.stopPropagation();
    setSelectedBook(book);
    resetForm(book);
    setEditModalOpen(true);
  };

  const handleAddBook = () => {
    resetForm();
    setAddModalOpen(true);
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'books'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBooks(data);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredBooks = useMemo(() => {
    return books.filter(b => {
      const title = b.title || '';
      const author = b.author || '';
      const isbn = b.isbn || '';
      const category = b.category || '';
      const status = b.status || '';

      const matchesSearch = !search || `${title} ${author} ${isbn}`.toLowerCase().includes(search.toLowerCase());
      const matchesCat = !catFilter || category === catFilter;
      const matchesAvail = !availFilter || status === availFilter;
      return matchesSearch && matchesCat && matchesAvail;
    });
  }, [books, search, catFilter, availFilter]);

  const totalPages = Math.ceil(filteredBooks.length / booksPerPage);
  const paginatedBooks = filteredBooks.slice((page - 1) * booksPerPage, page * booksPerPage);

  return (
    <section className="section active" id="sec-inventory">
      <div className="section-header">
        <div>
          <h2>Library Inventory</h2>
          <p>Centralized catalog of all books and resources</p>
        </div>
        <button className="btn btn-primary" onClick={handleAddBook}>＋ Add Book</button>
      </div>

      <div className="toolbar">
        <div className="search-field">
          <span className="ico">🔍</span>
          <input 
            type="text" 
            placeholder="Search by title, author, or ISBN…" 
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="filter-select" value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          <option>Computer Science</option>
          <option>Electronics</option>
          <option>Mathematics</option>
          <option>Management</option>
          <option>Physics</option>
          <option>General Fiction</option>
          <option>Mechanical</option>
        </select>
        <select className="filter-select" value={availFilter} onChange={(e) => { setAvailFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="Available">Available</option>
          <option value="Loaned">Loaned Out</option>
          <option value="Archived">Archived</option>
          <option value="Lost">Lost</option>
        </select>
        <span style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
          {filteredBooks.length} books
        </span>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
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
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '20px' }}>Loading books...</td>
                </tr>
              ) : paginatedBooks.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <div className="es-icon">📚</div>
                      <p>No books match your criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedBooks.map((b, index) => {
                  const avPct = b.totalCopies ? Math.round((b.availCopies / b.totalCopies) * 100) : 0;
                  const isZero = b.availCopies === 0;
                  // Use index or random number based on ID for color if ID is a complex string
                  const colorIndex = (b.id.length || index) % 8;
                  const colorHex = COLORS[colorIndex];
                  
                  return (
                    <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => handleViewBook(b)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div 
                            className="book-cover-placeholder" 
                            style={{ background: `${colorHex}22`, color: colorHex, width: '40px', height: '54px', fontSize: '1.2rem' }}
                          >
                            📖
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '.85rem', color: 'var(--navy)', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {b.title}
                            </div>
                            <div style={{ fontSize: '.73rem', color: 'var(--text-muted)' }}>
                              {b.author} · {b.year}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '.72rem', color: 'var(--text-sec)' }}>{b.isbn}</td>
                      <td><span className="status-pill pill-blue" style={{ fontSize: '.66rem' }}>{b.category}</span></td>
                      <td style={{ fontSize: '.85rem', textAlign: 'center' }}>{b.totalCopies}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '.85rem', fontWeight: 600, color: isZero ? 'var(--red)' : 'var(--green)' }}>
                            {b.availCopies}
                          </span>
                          <div className="progress-bar" style={{ width: '50px' }}>
                            <div 
                              className="progress-fill" 
                              style={{ width: `${avPct}%`, background: isZero ? 'var(--red)' : 'var(--green)' }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '.75rem', color: 'var(--text-sec)' }}>{b.location}</td>
                      <td><span className={`status-pill ${statusPillMap[b.status] || 'pill-navy'}`}>{b.status}</span></td>
                      <td style={{ textAlign: 'right', paddingRight: '16px' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                          <button className="btn btn-outline btn-sm" onClick={(e) => handleEditBook(e, b)}>✏️</button>
                          <button className="btn btn-outline btn-sm" style={{ color: 'var(--red)' }} onClick={(e) => { e.stopPropagation(); handleDeleteBook(b.id); }}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="card-footer">
          <span style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>
            Showing {filteredBooks.length === 0 ? 0 : (page - 1) * booksPerPage + 1}–{Math.min(page * booksPerPage, filteredBooks.length)} of {filteredBooks.length} books
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

      {/* Book Details Modal */}
      {selectedBook && (
        <div className="overlay open" onClick={handleCloseModal}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Book Details</h3>
              <button className="modal-close" onClick={handleCloseModal}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: '20px', marginBottom: '16px' }}>
                <div style={{ 
                  width: '80px', height: '110px', borderRadius: '8px', 
                  background: `${COLORS[(selectedBook.id?.length || 0) % 8]}22`, 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  fontSize: '2.5rem', flexShrink: 0 
                }}>📖</div>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '4px' }}>
                    {selectedBook.title}
                  </div>
                  <div style={{ fontSize: '.85rem', color: 'var(--text-sec)', marginBottom: '6px' }}>
                    By <strong>{selectedBook.author}</strong> · {selectedBook.year}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="status-pill pill-blue">{selectedBook.category}</span>
                    <span className={`status-pill ${selectedBook.status === 'Available' ? 'pill-green' : selectedBook.status === 'Lost' ? 'pill-red' : 'pill-amber'}`}>
                      {selectedBook.status}
                    </span>
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                {[
                  ['ISBN', selectedBook.isbn], 
                  ['Location', selectedBook.location], 
                  ['Total Copies', selectedBook.totalCopies], 
                  ['Available', selectedBook.availCopies]
                ].map(([l, v], i) => (
                  <div key={i} style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: '10px 14px', border: '1px solid var(--border-soft)' }}>
                    <div style={{ fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: '3px' }}>{l}</div>
                    <div style={{ fontSize: '.88rem', fontWeight: 600, color: 'var(--navy)', fontFamily: l === 'ISBN' || l === 'Location' ? 'var(--font-mono)' : 'inherit' }}>{v}</div>
                  </div>
                ))}
              </div>
              
              <h4 style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '10px' }}>📋 Recent Transaction History</h4>
              <div>
                {bookTransactions.length > 0 ? (
                  bookTransactions.slice(0, 3).map((t, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderBottom: '1px solid var(--border-soft)', fontSize: '.8rem' }}>
                      <span className={`status-pill ${t.status === 'Returned' ? 'pill-green' : t.status === 'Overdue' || t.status === 'Lost' ? 'pill-red' : 'pill-amber'}`}>{t.status}</span>
                      <span style={{ flex: 1, color: 'var(--text-primary)' }}>{t.userName}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{t.checkout} → {t.due}</span>
                      <span style={{ color: t.fine > 0 ? 'var(--red)' : 'var(--green)' }}>₹{t.fine}</span>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>No transaction history found.</p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={handleCloseModal}>Close</button>
              <button className="btn btn-primary" onClick={(e) => handleEditBook(e, selectedBook)}>✏️ Edit Record</button>
            </div>
          </div>
        </div>
      )}

      {(addModalOpen || editModalOpen) && (
        <div className="overlay open" onClick={() => { setAddModalOpen(false); setEditModalOpen(false); }}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editModalOpen ? 'Edit Book' : 'Add New Book'}</h3>
              <button className="modal-close" onClick={() => { setAddModalOpen(false); setEditModalOpen(false); }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Book Title *</label>
                  <input className="form-control" placeholder="e.g. Clean Code" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Author *</label>
                  <input className="form-control" placeholder="e.g. Robert C. Martin" value={formData.author} onChange={e => setFormData({...formData, author: e.target.value})} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">ISBN *</label>
                  <input className="form-control" placeholder="978-XXXXXXXXXX" value={formData.isbn} onChange={e => setFormData({...formData, isbn: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-control" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    <option>Computer Science</option>
                    <option>Electronics</option>
                    <option>Mathematics</option>
                    <option>Management</option>
                    <option>Physics</option>
                    <option>General Fiction</option>
                    <option>Mechanical</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Year</label>
                  <input className="form-control" placeholder="2024" value={formData.year} onChange={e => setFormData({...formData, year: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Shelf Location</label>
                  <input className="form-control" placeholder="e.g. A-102" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Total Copies</label>
                  <input className="form-control" type="number" min="1" value={formData.totalCopies} onChange={e => setFormData({...formData, totalCopies: parseInt(e.target.value) || 0})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Available Copies</label>
                  <input className="form-control" type="number" min="0" value={formData.availCopies} onChange={e => setFormData({...formData, availCopies: parseInt(e.target.value) || 0})} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => { setAddModalOpen(false); setEditModalOpen(false); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveBook}>{editModalOpen ? 'Update Book' : 'Add to Catalog'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
