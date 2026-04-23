import React, { useState, useEffect, useMemo } from 'react';
// Track sync
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAuth } from '../../lib/AuthContext';
import { db, auth } from '../../lib/firebase';
import { collection, onSnapshot, doc, getDoc, updateDoc, setDoc, query, orderBy } from '@/src/lib/dbClient';
import { signOut } from 'firebase/auth';
import { logAudit } from '../../lib/audit';
import { ProfileModal } from '../../components/ProfileModal';
import { NotificationBell } from '../../components/NotificationBell';
import { useNavigate, Navigate } from 'react-router-dom';
import { BarcodeScanner } from '../../components/BarcodeScanner';
import './librarian.css';

export default function LibrarianDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [activeMode, setActiveMode] = useState('issue');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  
  // Real-time Firestore state
  const [books, setBooks] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [procurements, setProcurements] = useState<any[]>([]);
  const [bulkRequests, setBulkRequests] = useState<any[]>([]);

  // Circulation State
  const [studentId, setStudentId] = useState('');
  const [memberData, setMemberData] = useState<any>(null);
  const [scannedIsbn, setScannedIsbn] = useState('');
  const [queuedBooks, setQueuedBooks] = useState<any[]>([]);
  const [circDueDate, setCircDueDate] = useState(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));

  // Modals
  const [addBookModalOpen, setAddBookModalOpen] = useState(false);
  const [editBookModalOpen, setEditBookModalOpen] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [discardModalOpen, setDiscardModalOpen] = useState(false);
  const [deskNotifModalOpen, setDeskNotifModalOpen] = useState(false);
  const [fineModalOpen, setFineModalOpen] = useState(false);
  const [waiveModalOpen, setWaiveModalOpen] = useState(false);
  const [discardItem, setDiscardItem] = useState<{ id: string, title?: string } | null>(null);

  // Fines
  const [pendingFineTransactions, setPendingFineTransactions] = useState<any[]>([]);
  const pendingFineAmount = pendingFineTransactions.reduce((acc, t) => acc + (Number(t.fine) || 0), 0);
  const [finePaymentMode, setFinePaymentMode] = useState('');
  const [fineReceiptNumber, setFineReceiptNumber] = useState('');
  const [waiveReason, setWaiveReason] = useState('');
  const [waiveNotes, setWaiveNotes] = useState('');

  // Add/Edit Book Form State
  const [formData, setFormData] = useState({
    title: '', author: '', isbn: '', category: 'Computer Science', 
    year: new Date().getFullYear().toString(), totalCopies: 1, availCopies: 1, location: ''
  });

  // Reports state
  const [reportDateRange, setReportDateRange] = useState('Today');
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');
  const [reportType, setReportType] = useState('');
  const [reportSearch, setReportSearch] = useState('');

  // Inventory filter state
  const [invSearch, setInvSearch] = useState('');
  const [invCat, setInvCat] = useState('');
  const [invStatus, setInvStatus] = useState('');
  const [invPage, setInvPage] = useState(1);
  const itemsPerPage = 10;
  
  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [isCircUserScanning, setIsCircUserScanning] = useState(false);
  const [isCircBookScanning, setIsCircBookScanning] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const lookupBookByIsbn = async (isbn: string) => {
    setIsLookingUp(true);
    let fillData: any = { isbn };
    try {
      const gBooksResponse = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
      const gBooksData = await gBooksResponse.json();
      
      if (gBooksData.items && gBooksData.items.length > 0) {
        const info = gBooksData.items[0].volumeInfo;
        fillData = {
          ...fillData,
          title: info.title || '',
          author: info.authors ? info.authors.join(', ') : '',
          category: (info.categories && info.categories.length > 0) ? info.categories[0] : 'General Fiction',
          year: info.publishedDate ? info.publishedDate.substring(0, 4) : new Date().getFullYear().toString(),
        };
        toast.success(`Found metadata for ${isbn}!`);
      } else {
        toast.error(`Book metadata not found for ${isbn}. Please enter details manually.`);
      }
    } catch(err) {
      console.error(err);
      toast.error('Failed to lookup book metadata.');
    }
    setIsLookingUp(false);
    return fillData;
  };

  const processScannedIsbn = async (isbn: string) => {
    const bookExists = books.find(b => b.isbn === isbn || String(b.id) === isbn);
    if(bookExists) {
        toast.info(`Book already exists. ID: ${bookExists.id}. Consider editing the existing book.`);
    } else {
        const metadata = await lookupBookByIsbn(isbn);
        resetForm();
        setFormData(prev => ({ ...prev, ...metadata }));
        setAddBookModalOpen(true);
        setScannedIsbn('');
        setIsScanning(false);
    }
  };

  const resetForm = (book: any = null) => {
    if (book) {
      setFormData({
        title: book.title, author: book.author, isbn: book.isbn || '',
        category: book.category || 'Computer Science', year: book.year || new Date().getFullYear().toString(), 
        totalCopies: book.totalCopies, availCopies: book.availCopies, location: book.location || ''
      });
      setSelectedBookId(book.id);
    } else {
      setFormData({
        title: '', author: '', isbn: '', category: 'Computer Science', 
        year: new Date().getFullYear().toString(), totalCopies: 1, availCopies: 1, location: ''
      });
      setSelectedBookId(null);
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
      
      if (editBookModalOpen && selectedBookId) {
        await updateDoc(doc(db, 'books', selectedBookId), bookData);
        await logAudit('PATCH', `Updated book: ${bookData.title}`, 200);
        toast.success('Book updated!');
      } else {
        const newId = `book-${Date.now()}`;
        await setDoc(doc(db, 'books', newId), bookData);
        await logAudit('POST', `Added new book to catalog (Librarian Desk): ${bookData.title}`, 200);
        toast.success('Book successfully added to catalog!');
      }
      
      setAddBookModalOpen(false);
      setEditBookModalOpen(false);
      resetForm();
    } catch (err) {
      toast.error('Failed to save book.');
      console.error(err);
    }
  };

  const nav = (sec: string) => {
    setActiveSection(sec);
    setIsScanning(false);
    setIsCircUserScanning(false);
    setIsCircBookScanning(false);
  };
  
  const changeCircMode = (mode: string) => {
    setActiveMode(mode);
    setIsCircBookScanning(false);
    setIsCircUserScanning(false);
  };

  const handleToggleCircUserScanner = () => {
    setIsCircUserScanning(prev => {
      if (!prev) setIsCircBookScanning(false);
      return !prev;
    });
  };

  const handleToggleCircBookScanner = () => {
    setIsCircBookScanning(prev => {
      if (!prev) setIsCircUserScanning(false);
      return !prev;
    });
  };

  // Firestore bindings
  useEffect(() => {
    if (!user) return;
    
    const unsubBooks = onSnapshot(collection(db, 'books'), snap => {
      setBooks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    const unsubTx = onSnapshot(query(collection(db, 'transactions'), orderBy('checkout', 'desc')), snap => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    const unsubProcurements = onSnapshot(collection(db, 'procurements'), snap => {
      setProcurements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubBulkReqs = onSnapshot(collection(db, 'bulkRequests'), snap => {
      setBulkRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 's') { e.preventDefault(); nav('dashboard'); setTimeout(() => document.getElementById('omniInput')?.focus(), 100); }
      if (e.altKey && e.key.toLowerCase() === 'i') { e.preventDefault(); nav('circulation'); setTimeout(() => changeCircMode('issue'), 100); }
      if (e.altKey && e.key.toLowerCase() === 'r') { e.preventDefault(); nav('circulation'); setTimeout(() => changeCircMode('return'), 100); }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubBooks(); unsubTx(); unsubUsers(); unsubProcurements(); unsubBulkReqs(); window.removeEventListener('keydown', handleKeyDown);
    };
  }, [user]);

  const handleLookupStudentFromScanner = (scannedText: string) => {
    if (!scannedText) return;
    setStudentId(scannedText);
    const foundUser = users.find(u => u.userId === scannedText || u.email === scannedText);
    if (!foundUser) {
      toast.error('User not found in system.');
      setMemberData(null);
      return;
    }
    toast.success(`Looked up user: ${foundUser.firstName}`);
    const userTx = transactions.filter(t => t.userId === foundUser.userId);
    setMemberData({
      ...foundUser,
      held: userTx.filter(t => ['Borrowed', 'Overdue'].includes(t.status)),
      history: userTx.filter(t => ['Returned', 'Lost'].includes(t.status)),
      fines: userTx.filter(t => (Number(t.fine) || 0) > 0)
    });
  };

  const handleLookupStudent = (idOverride?: string | React.MouseEvent | React.KeyboardEvent) => {
    // If it's an event object, ignore it and use studentId state
    const idStr = typeof idOverride === 'string' ? idOverride : studentId;
    const idToSearch = idStr;
    if (!idToSearch) return;
    const foundUser = users.find(u => u.userId === idToSearch || u.email === idToSearch);
    if (!foundUser) {
      toast.error('User not found in system.');
      setMemberData(null);
      return;
    }
    if (typeof idOverride !== 'string') {
      toast.success(`Looked up user: ${foundUser.firstName}`);
    }
    const userTx = transactions.filter(t => t.userId === foundUser.userId);
    setMemberData({
      ...foundUser,
      held: userTx.filter(t => ['Borrowed', 'Overdue'].includes(t.status)),
      history: userTx.filter(t => ['Returned', 'Lost'].includes(t.status)),
      fines: userTx.filter(t => (Number(t.fine) || 0) > 0)
    });
  };

  const handleOmniSearch = (val: string) => {
    const input = val.trim();
    if (!input) return;
    const compact = input.replace(/-/g, '');
    if (/^\d{10,13}$/.test(compact)) {
      const book = books.find(b => String(b.isbn).replace(/-/g, '') === compact || String(b.id) === compact);
      if (book) toast.success(`Found "${book.title}" - ${book.availCopies}/${book.totalCopies} copies available.`);
      else toast.error(`ISBN ${input} is not in the live catalog.`);
      return;
    }
    if (/^(?:\d{2}VR|FAC-|ADM-|LIB-)/i.test(input) || input.includes('@')) {
      nav('circulation');
      setStudentId(input);
      setTimeout(() => handleLookupStudent(input), 200);
      return;
    }
    if (input.length > 2) {
      const results = books.filter(b => `${b.title} ${b.author}`.toLowerCase().includes(input.toLowerCase())).slice(0, 3);
      if (results.length) {
        toast.success(`Found ${results.length} live match${results.length === 1 ? '' : 'es'}: ${results.map(b => b.title).join(', ')}`);
        nav('inventory');
      } else {
        toast.error(`No live catalog matching "${input}".`);
      }
    }
  };

  const settleFine = async (action: string) => {
    if (!pendingFineTransactions.length) {
      toast.warning('No fine records selected.');
      return;
    }
    if (action === 'paid' && !finePaymentMode) {
      toast.warning('Choose a payment mode before recording payment.');
      return;
    }
    try {
      if (action === 'waive' && !waiveReason) {
        toast.error('Please choose a waiver reason.');
        return;
      }
      for (const t of pendingFineTransactions) {
        await updateDoc(doc(db, 'transactions', t.id), {
          fineStatus: action === 'waive' ? 'Waived' : action === 'paid' ? 'Paid' : 'Ledger',
          finePaymentMode: action === 'paid' ? finePaymentMode : undefined,
          fineReceiptNumber: action === 'paid' ? fineReceiptNumber : undefined,
          waiveReason: action === 'waive' ? waiveReason : undefined,
          waiveNotes: action === 'waive' ? waiveNotes : undefined,
        });
      }
      toast.success(`${pendingFineTransactions.length} fine record(s) updated.`);
      setPendingFineTransactions([]);
      setFineModalOpen(false);
      setWaiveModalOpen(false);
      setFinePaymentMode('');
      setFineReceiptNumber('');
      setWaiveReason('');
      setWaiveNotes('');
      // refresh lookup
      if (memberData) handleLookupStudent();
    } catch (err: any) {
      toast.error('Unable to update fine records.');
    }
  };

  const exportLibrarianCsv = () => {
    const headers = ['Txn ID', 'User', 'Book', 'Action Date', 'Fine', 'Status'];
    const rows = filteredTransactions.map(t => [
      t.id.slice(-8), 
      t.userName, 
      t.bookTitle, 
      t.checkout || t.returned || 'N/A', 
      t.fine > 0 ? t.fine : '-', 
      t.status
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'librarian-report.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success(`Exported ${rows.length} report rows.`);
  };

  const sendLibrarianReminders = async () => {
    const dueCount = overdueLoans;
    if (dueCount === 0) {
      toast.info('No overdue items to remind about.');
      return;
    }
    toast.success(`Reminder workflows prepared for ${dueCount} items.`);
  };

  const undoLastDeskAction = () => {
    toast.info('Undo system action requires admin privileges, please contact admin or manually amend.');
  };

  const runBulkInventoryAction = async () => {
    toast.success('Bulk update mode activated. Check off books to edit category tags en masse.');
  };

  const handleProcessIsbnFromScanner = (scannedText: string) => {
    if (!scannedText) return;
    const book = books.find(b => b.isbn === scannedText || String(b.id) === scannedText);
    if (!book) {
      toast.error('Book not found in live catalog.');
      return;
    }
    // Prevent duplicate queues
    if (queuedBooks.find(q => q.id === book.id)) {
      toast.info('Book already in queue.');
      return;
    }
    setQueuedBooks(prev => [...prev, book]);
    setScannedIsbn('');
  };

  const handleProcessIsbn = () => {
    if (!scannedIsbn) return;
    const book = books.find(b => b.isbn === scannedIsbn || String(b.id) === scannedIsbn);
    if (!book) {
      toast.error('Book not found in live catalog.');
      return;
    }
    // Prevent duplicate queues
    if (queuedBooks.find(q => q.id === book.id)) {
      toast.info('Book already in queue.');
      return;
    }
    setQueuedBooks(prev => [...prev, book]);
    setScannedIsbn('');
  };

  const handleConfirmTransaction = async () => {
    if (!memberData || queuedBooks.length === 0) return;
    
    try {
      if (activeMode === 'issue') {
        for (const book of queuedBooks) {
          if (book.availCopies < 1) {
            toast.error(`"${book.title}" has no available copies.`);
            continue;
          }
          const txId = `TXN-${Date.now()}-${Math.floor(Math.random()*1000)}`;
          await setDoc(doc(db, 'transactions', txId), {
            userId: memberData.userId,
            userName: `${memberData.firstName} ${memberData.lastName}`,
            bookId: book.id,
            bookTitle: book.title,
            checkout: new Date().toISOString().split('T')[0],
            due: circDueDate,
            status: 'Borrowed',
            fine: 0,
            fineStatus: 'None'
          });
          await updateDoc(doc(db, 'books', book.id), {
            availCopies: book.availCopies - 1,
            status: book.availCopies - 1 === 0 ? 'Loaned' : 'Available'
          });
          await logAudit('POST', `Desk Issued: ${book.title}`, 200);
        }
        toast.success(`Successfully issued ${queuedBooks.length} books.`);
      } else {
        // Return flow
        for (const book of queuedBooks) {
          const activeTx = transactions.find(t => t.bookId === book.id && t.userId === memberData.userId && ['Borrowed', 'Overdue'].includes(t.status));
          if (!activeTx) {
            toast.error(`"${book.title}" is not currently issued to this user.`);
            continue;
          }
          await updateDoc(doc(db, 'transactions', activeTx.id), {
            status: 'Returned',
            returned: new Date().toISOString().split('T')[0]
          });
          await updateDoc(doc(db, 'books', book.id), {
            availCopies: Number(book.availCopies || 0) + 1,
            status: 'Available'
          });
          await logAudit('POST', `Desk Returned: ${book.title}`, 200);
        }
        toast.success(`Successfully returned ${queuedBooks.length} books.`);
      }
      setQueuedBooks([]);
      handleLookupStudent(); // Refresh member view
    } catch (err) {
      toast.error('Transaction failed.');
      console.error(err);
    }
  };

  // Filtering logic for reports
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      let matchesDate = true;
      const txDate = new Date(t.checkout || t.returned || t.createdAt || Date.now());
      const now = new Date();
      
      if (reportDateRange === 'Today') {
        matchesDate = txDate.toDateString() === now.toDateString();
      } else if (reportDateRange === 'Last 7 Days') {
        const last7 = new Date();
        last7.setDate(last7.getDate() - 7);
        matchesDate = txDate >= last7;
      } else if (reportDateRange === 'This Month') {
        matchesDate = txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
      } else if (reportDateRange === 'Custom Range') {
        if (reportFrom) matchesDate = matchesDate && txDate >= new Date(reportFrom);
        if (reportTo) {
          const toDate = new Date(reportTo);
          toDate.setHours(23, 59, 59, 999);
          matchesDate = matchesDate && txDate <= toDate;
        }
      }

      let matchesType = true;
      if (reportType) {
        // Simple mapping from report options
        if (reportType === 'Issued') matchesType = t.status === 'Borrowed';
        else if (reportType === 'Returned') matchesType = t.status === 'Returned';
        else if (reportType === 'Lost') matchesType = t.status === 'Lost';
        else if (reportType === 'Overdue') matchesType = t.status === 'Overdue';
        else matchesType = t.status === reportType; 
      }

      let matchesSearch = true;
      if (reportSearch) {
        const search = reportSearch.toLowerCase();
        matchesSearch = String(t.id).toLowerCase().includes(search) || 
                        String(t.userName).toLowerCase().includes(search) || 
                        String(t.bookTitle).toLowerCase().includes(search);
      }

      return matchesDate && matchesType && matchesSearch;
    });
  }, [transactions, reportDateRange, reportFrom, reportTo, reportType, reportSearch]);

  const reportChartData = useMemo(() => {
    // Generate simple hourly breakdown based on filteredTransactions
    const hours = [10, 11, 12, 13, 14, 15, 16];
    return hours.map(h => {
        let count = 0;
        filteredTransactions.forEach(t => {
           const txDate = new Date(t.checkout || t.returned || t.createdAt || Date.now());
           if (txDate.getHours() === h) count++;
        });
        const name = h > 12 ? `${h-12}pm` : h === 12 ? '12pm' : `${h}am`;
        return { name, count };
    });
  }, [filteredTransactions]);

  const activeLoans = transactions.filter(t => t.status === 'Borrowed').length;
  const overdueLoans = transactions.filter(t => t.status === 'Overdue' || (t.due && new Date(t.due) < new Date() && t.status === 'Borrowed')).length;
  const recentReturns = transactions.filter(t => t.status === 'Returned').length;
  const fineRecords = transactions.filter(t => Number(t.fine) > 0 && t.fineStatus !== 'Paid').length;

  const dashChartData = [
    { name: 'Due/Overdue', count: overdueLoans },
    { name: 'Active Loans', count: activeLoans },
    { name: 'Total Titles', count: books.length },
    { name: 'Returns', count: recentReturns },
  ];

  const filteredInventory = useMemo(() => {
    return books.filter(b => {
      const title = b.title || '';
      const author = b.author || '';
      const isbn = b.isbn || '';
      const category = b.category || '';
      const status = b.status || '';

      const matchesSearch = !invSearch || `${title} ${author} ${isbn}`.toLowerCase().includes(invSearch.toLowerCase());
      const matchesCat = !invCat || category === invCat;
      const matchesAvail = !invStatus || status === invStatus;
      return matchesSearch && matchesCat && matchesAvail;
    });
  }, [books, invSearch, invCat, invStatus]);

  const totalInvPages = Math.ceil(filteredInventory.length / itemsPerPage);
  const paginatedInventory = filteredInventory.slice((invPage - 1) * itemsPerPage, invPage * itemsPerPage);

  const librarianName = user?.displayName || user?.email?.split('@')[0] || 'Librarian';

  const handleLogout = async () => {
    try {
      logout();
      // Wait for AuthContext to update, Navigate handles redirect
    } catch(err) {
      toast.error('Failed to log out');
    }
  };

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
      {/* ═══════ MODALS ═══════ */}
      {(addBookModalOpen || editBookModalOpen) && (
        <div className="ovl open" onClick={(e) => { if (e.target === e.currentTarget) { setAddBookModalOpen(false); setEditBookModalOpen(false); } }}>
          <div className="modal" style={{ maxWidth: '650px' }}>
            <div className="mhdr">
              <h3>{editBookModalOpen ? '✏️ Edit Book Data' : '＋ Add New Book'}</h3>
              <button className="mcls" onClick={() => { setAddBookModalOpen(false); setEditBookModalOpen(false); }}>✕</button>
            </div>
            <div className="mbdy">
              <div className="g2">
                <div className="fg">
                  <label className="flbl">Book Title <span>*</span></label>
                  <input className="fc" placeholder="e.g. Clean Code" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                </div>
                <div className="fg">
                  <label className="flbl">Author <span>*</span></label>
                  <input className="fc" placeholder="e.g. Robert C. Martin" value={formData.author} onChange={e => setFormData({ ...formData, author: e.target.value })} />
                </div>
              </div>
              <div className="g2">
                <div className="fg">
                  <label className="flbl">ISBN <span>*</span></label>
                  <input className="fc" placeholder="978-XXXXXXXXXX" value={formData.isbn} onChange={e => setFormData({ ...formData, isbn: e.target.value })} />
                </div>
                <div className="fg">
                  <label className="flbl">Category</label>
                  <select className="fc" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
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
              <div className="g2">
                <div className="fg">
                  <label className="flbl">Pub Year</label>
                  <input className="fc" placeholder="2024" value={formData.year} onChange={e => setFormData({ ...formData, year: e.target.value })} />
                </div>
                <div className="fg">
                  <label className="flbl">Shelf Location</label>
                  <input className="fc" placeholder="e.g. A-102" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
                </div>
              </div>
              <div className="g2">
                <div className="fg">
                  <label className="flbl">Total Copies</label>
                  <input className="fc" type="number" min="1" value={formData.totalCopies} onChange={e => setFormData({ ...formData, totalCopies: Number(e.target.value) || 0 })} />
                </div>
                <div className="fg">
                  <label className="flbl">Available Copies</label>
                  <input className="fc" type="number" min="0" value={formData.availCopies} onChange={e => setFormData({ ...formData, availCopies: Number(e.target.value) || 0 })} />
                </div>
              </div>
            </div>
            <div className="mftr">
              <button className="btn btn-outline" onClick={() => { setAddBookModalOpen(false); setEditBookModalOpen(false); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveBook}>{editBookModalOpen ? 'Update Book' : 'Add to Catalog'}</button>
            </div>
          </div>
        </div>
      )}

      {discardModalOpen && discardItem && (
        <div className="ovl open" onClick={(e) => { if (e.target === e.currentTarget) setDiscardModalOpen(false); }}>
          <div className="modal">
            <div className="mhdr">
              <h3>🗑️ Mark Book as Lost / Damaged</h3>
              <button className="mcls" onClick={() => setDiscardModalOpen(false)}>✕</button>
            </div>
            <div className="mbdy">
              <div style={{ fontWeight: 600, marginBottom: '10px' }}>Managing: <span style={{ color: 'var(--slate-700)' }}>{discardItem.title}</span></div>
              <p style={{ fontSize: '.83rem', color: 'var(--slate-500)', marginBottom: '16px', lineHeight: 1.6 }}>
                This is integrated with the live inventory. Lowering active count.
              </p>
            </div>
            <div className="mftr">
              <button className="btn btn-outline" onClick={() => setDiscardModalOpen(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={async () => { 
                const dbBook = books.find(b => b.id === discardItem.id);
                if (dbBook) {
                  await updateDoc(doc(db, 'books', dbBook.id), {
                    availCopies: Math.max(0, dbBook.availCopies - 1),
                    totalCopies: Math.max(0, dbBook.totalCopies - 1)
                  });
                  logAudit('DELETE', `Marked ${dbBook.title} as lost/damaged`, 200).catch(console.error);
                }
                toast.success('Logged loss & updated inventory'); 
                setDiscardModalOpen(false); 
              }}>⚠️ Confirm Loss</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ APP SHELL ═══════ */}
      <div className="app">
        {/* SIDEBAR */}
        <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
          <button className="sb-toggle" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>◀</button>
          <div className="sb-head">
            <div className="sb-logo">📚</div>
            <div className="sb-brand">Vemu Library<small>Librarian Desk</small></div>
          </div>
          <nav className="sb-nav">
            <div className="sb-label">Desk</div>
            <div className={`sb-link ${activeSection === 'dashboard' ? 'active' : ''}`} onClick={() => nav('dashboard')}><div className="ico">🏠</div><span className="lbl">Dashboard</span></div>
            <div className={`sb-link ${activeSection === 'requests' ? 'active' : ''}`} onClick={() => nav('requests')}><div className="ico">📥</div><span className="lbl">Requests</span></div>
            <div className="sb-label">Circulation</div>
            <div className={`sb-link ${activeSection === 'circulation' ? 'active' : ''}`} onClick={() => nav('circulation')}><div className="ico">🔄</div><span className="lbl">Circulation Hub</span></div>
            <div className="sb-label">Catalog</div>
            <div className={`sb-link ${activeSection === 'inventory' ? 'active' : ''}`} onClick={() => nav('inventory')}><div className="ico">📖</div><span className="lbl">Inventory Tracker</span></div>
            <div className="sb-label">Reports</div>
            <div className={`sb-link ${activeSection === 'reports' ? 'active' : ''}`} onClick={() => nav('reports')}><div className="ico">📊</div><span className="lbl">Live Ledger</span></div>
          </nav>
          <div className="sb-foot">
            <div className="sb-user" onClick={() => setIsProfileModalOpen(true)} style={{ cursor: 'pointer' }}>
              <div className="sb-av" style={{ background: 'var(--blue)', color: 'white' }}>{librarianName[0].toUpperCase()}</div>
              <div className="sb-uinfo">
                <div className="sb-uname">{librarianName}</div>
                <div className="sb-urole">Live Desk Duty</div>
              </div>
            </div>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <div className="topbar-ttl">
              <span>{activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}</span>
            </div>
            <div className="topbar-sp"></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="topbar-kbd">
                <span className="kbd">Alt</span>+<span className="kbd">I</span> Issue &nbsp;
                <span className="kbd">Alt</span>+<span className="kbd">R</span> Return
              </div>
              <button 
                onClick={undoLastDeskAction}
                style={{ padding: '6px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.85rem' }}
                title="Undo last desk action"
              >
                <span>↩️</span> <span className="hide-on-mobile">Undo</span>
              </button>
              <NotificationBell />
              <button 
                onClick={handleLogout}
                style={{ padding: '6px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>🚪</span> <span className="hide-on-mobile">Logout</span>
              </button>
            </div>
          </header>

          <div className="content">
            {/* DASHBOARD */}
            {activeSection === 'dashboard' && (
              <section className="section active">
                 <div className="omni-wrap">
                  <div className="omni-label">Live Omni Search</div>
                  <div className="omni-field">
                    <span className="omni-ico">🔍</span>
                     <input 
                      id="omniInput" className="omni-input" 
                      placeholder="Enter Student ID / Email to scan…"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleOmniSearch(e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="stats-row">
                  <div className="scard"><div className="scard-top"><div className="scard-ico" style={{ background: 'var(--red-bg)' }}>📅</div><span className="scard-chip" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>Urgent</span></div><div className="scard-num">{overdueLoans}</div><div className="scard-lbl">Overdue</div></div>
                  <div className="scard"><div className="scard-top"><div className="scard-ico" style={{ background: 'var(--blue-bg)' }}>📦</div><span className="scard-chip" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>Live</span></div><div className="scard-num">{books.length}</div><div className="scard-lbl">Inventory</div></div>
                  <div className="scard"><div className="scard-top"><div className="scard-ico" style={{ background: 'var(--amber-bg)' }}>⚖️</div><span className="scard-chip" style={{ background: 'var(--amber-bg)', color: 'var(--amber)' }}>Outstanding</span></div><div className="scard-num">{fineRecords}</div><div className="scard-lbl">Pending Fines</div></div>
                  <div className="scard"><div className="scard-top"><div className="scard-ico" style={{ background: 'var(--emerald-bg)' }}>🔄</div><span className="scard-chip" style={{ background: 'var(--emerald-bg)', color: 'var(--emerald)' }}>Active</span></div><div className="scard-num">{activeLoans}</div><div className="scard-lbl">Active Loans</div></div>
                </div>

                <div className="g-dash">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="g2" style={{ marginBottom: '16px' }}>
                      <div className="card" style={{ cursor: 'pointer' }} onClick={() => { nav('circulation'); setTimeout(() => {setActiveMode('issue')}, 100); }}>
                        <div className="card-body" style={{ padding: '20px', textAlign: 'center' }}>
                          <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>📤</div>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700 }}>Issue Book</div>
                        </div>
                      </div>
                      <div className="card" style={{ cursor: 'pointer' }} onClick={() => { nav('circulation'); setTimeout(() => {setActiveMode('return')}, 100); }}>
                        <div className="card-body" style={{ padding: '20px', textAlign: 'center' }}>
                          <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>📥</div>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700 }}>Return Book</div>
                        </div>
                      </div>
                    </div>

                    <div className="insight-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                      <div className="insight-mini card" style={{ padding: '16px' }}>
                        <h4 style={{ fontSize: '.7rem', textTransform: 'uppercase', color: 'var(--slate-500)', margin: '0 0 6px 0' }}>Low Stock</h4>
                        <div className="num" style={{ fontSize: '1.4rem', fontWeight: 700 }}>{books.filter(b => b.availCopies < 2).length}</div>
                        <div className="meta" style={{ fontSize: '.75rem', color: 'var(--slate-400)' }}>{books.filter(b => b.availCopies < 2).length > 0 ? books.filter(b => b.availCopies < 2).slice(0, 2).map((book: any) => `${book.title} · ${book.availCopies} left`).join(', ') : 'No low-stock titles'}</div>
                      </div>
                      <div className="insight-mini card" style={{ padding: '16px' }}>
                        <h4 style={{ fontSize: '.7rem', textTransform: 'uppercase', color: 'var(--slate-500)', margin: '0 0 6px 0' }}>Archived</h4>
                        <div className="num" style={{ fontSize: '1.4rem', fontWeight: 700 }}>0</div>
                        <div className="meta" style={{ fontSize: '.75rem', color: 'var(--slate-400)' }}>No archived titles right now</div>
                      </div>
                      <div className="insight-mini card" style={{ padding: '16px', cursor: 'pointer', transition: 'background 0.2s' }} onClick={() => setDeskNotifModalOpen(true)} onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <h4 style={{ fontSize: '.7rem', textTransform: 'uppercase', color: 'var(--slate-500)', margin: '0 0 6px 0' }}>Reminders Today</h4>
                          <span style={{ fontSize: '1rem' }}>🔔</span>
                        </div>
                        <div className="num" style={{ fontSize: '1.4rem', fontWeight: 700 }}>{overdueLoans}</div>
                        <div className="meta" style={{ fontSize: '.75rem', color: 'var(--slate-400)' }}>{overdueLoans > 0 ? `${overdueLoans} overdue loan(s) still open. Click to send.` : 'No overdue backlog right now'}</div>
                      </div>
                      <div className="insight-mini card" style={{ padding: '16px' }}>
                        <h4 style={{ fontSize: '.7rem', textTransform: 'uppercase', color: 'var(--slate-500)', margin: '0 0 6px 0' }}>Top Category</h4>
                        <div className="num" style={{ fontSize: '1.4rem', fontWeight: 700 }}>Engineering</div>
                        <div className="meta" style={{ fontSize: '.75rem', color: 'var(--slate-400)' }}>Catalog data is still building</div>
                      </div>
                    </div>

                    <div className="card">
                      <div className="card-hdr"><div className="card-ttl">📈 Today's Trend (Live)</div></div>
                      <div className="card-body">
                        <div className="cw">
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={dashChartData}>
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--slate-500)' }} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--slate-500)' }} />
                              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                {dashChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={['#ef4444', '#3b82f6', '#10b981', '#7c3aed'][index]} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card" style={{ alignSelf: 'flex-start', position: 'sticky', top: 0 }}>
                     <div className="card-hdr"><div className="card-ttl">⚡ Recent Transactions</div></div>
                     <div className="card-body" style={{ paddingTop: '8px', fontSize: '0.85rem' }}>
                       {transactions.slice(0, 8).map(t => (
                         <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                           <div><strong>{t.bookTitle}</strong><br /><span style={{ color: 'var(--slate-500)' }}>{t.userName}</span></div>
                           <span className={`pill ${t.status === 'Borrowed' ? 'p-blue' : 'p-green'}`}>{t.status}</span>
                         </div>
                       ))}
                       {transactions.length === 0 && <span style={{ color: 'var(--slate-500)' }}>No live transactions recorded.</span>}
                     </div>
                  </div>
                </div>
              </section>
            )}

            {/* REQUESTS */}
            {activeSection === 'requests' && (
              <section className="section active" id="sec-requests">
                <div className="sec-hdr">
                  <div>
                    <h2>Faculty Requests</h2>
                    <p>Manage Procurement and Bulk Issue requests.</p>
                  </div>
                </div>

                <div className="card" style={{ marginBottom: '20px' }}>
                  <div className="card-hdr">
                    <h3 className="card-ttl">📦 Bulk Issue Requests</h3>
                  </div>
                  <div className="tbl-wrap">
                    <table className="dtbl">
                      <thead>
                        <tr><th>Book Title</th><th>Requested By</th><th>Location</th><th>Copies</th><th>Status</th><th>Action</th></tr>
                      </thead>
                      <tbody>
                        {bulkRequests.length === 0 ? <tr><td colSpan={6} style={{textAlign: 'center', padding: '20px', color: 'var(--slate-400)'}}>No bulk requests found.</td></tr> :
                          bulkRequests.map(r => (
                            <tr key={r.id}>
                              <td><strong>{r.bookTitle}</strong></td>
                              <td>{r.creatorName}</td>
                              <td>{r.location}</td>
                              <td style={{fontFamily: 'var(--font-mono)'}}>{r.copies}</td>
                              <td><span className={`pill ${r.status === 'Pending' ? 'p-amber' : r.status === 'Approved' ? 'p-green' : 'p-red'}`}>{r.status}</span></td>
                              <td>
                                {r.status === 'Pending' ? (
                                  <div style={{display: 'flex', gap: '5px'}}>
                                    <button className="btn btn-emerald btn-sm" onClick={() => updateDoc(doc(db, 'bulkRequests', r.id), { status: 'Approved' })}>Approve</button>
                                    <button className="btn btn-outline btn-sm" onClick={() => updateDoc(doc(db, 'bulkRequests', r.id), { status: 'Denied' })}>Deny</button>
                                  </div>
                                ) : <span style={{fontSize: '.8rem', color: 'var(--slate-400)'}}>{r.status}</span>}
                              </td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card">
                  <div className="card-hdr">
                    <h3 className="card-ttl">🛒 Procurement Requests</h3>
                  </div>
                  <div className="tbl-wrap">
                    <table className="dtbl">
                      <thead>
                        <tr><th>Title</th><th>Author(s)</th><th>Requested By</th><th>Reason</th><th>Status</th><th>Action</th></tr>
                      </thead>
                      <tbody>
                        {procurements.length === 0 ? <tr><td colSpan={6} style={{textAlign: 'center', padding: '20px', color: 'var(--slate-400)'}}>No procurement requests found.</td></tr> :
                          procurements.map(r => (
                            <tr key={r.id}>
                              <td><strong>{r.title}</strong></td>
                              <td>{r.author}</td>
                              <td>{r.creatorName}</td>
                              <td style={{maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}} title={r.reason}>{r.reason}</td>
                              <td><span className={`pill ${r.status === 'Pending' ? 'p-amber' : r.status === 'Procuring' ? 'p-blue' : 'p-red'}`}>{r.status}</span></td>
                              <td>
                                {r.status === 'Pending' ? (
                                  <div style={{display: 'flex', gap: '5px'}}>
                                    <button className="btn btn-blue btn-sm" onClick={() => updateDoc(doc(db, 'procurements', r.id), { status: 'Procuring' })}>Procure</button>
                                    <button className="btn btn-outline btn-sm" onClick={() => updateDoc(doc(db, 'procurements', r.id), { status: 'Denied' })}>Deny</button>
                                  </div>
                                ) : <span style={{fontSize: '.8rem', color: 'var(--slate-400)'}}>{r.status}</span>}
                              </td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* CIRCULATION HUB */}
            {activeSection === 'circulation' && (
              <section className="section active" id="sec-circulation">
                <div className="sec-hdr">
                  <div>
                    <h2>Circulation Hub</h2>
                    <p>Split-screen issue & return desk — scan Student ID then Book ISBNs</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div className="mode-toggle">
                      <button className={`mode-btn issue ${activeMode === 'issue' ? 'active' : ''}`} onClick={() => changeCircMode('issue')}>📤 Issue Mode</button>
                      <button className={`mode-btn ret ${activeMode === 'return' ? 'active' : ''}`} onClick={() => changeCircMode('return')}>📥 Return Mode</button>
                    </div>
                  </div>
                </div>

                <div className="circ-split">
                  {/* LEFT: Student Panel */}
                  <div className="circ-panel">
                    <div className="circ-panel-ttl">👤 Student / Faculty Lookup</div>

                    {/* Scan Student ID */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
                        <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--slate-500)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                          Scan or Enter User ID
                        </div>
                        <button className="btn btn-blue btn-sm" onClick={handleToggleCircUserScanner}>
                          {isCircUserScanning ? 'Stop Camera' : '📷 Use Camera'}
                        </button>
                      </div>
                      
                      {isCircUserScanning && (
                        <div style={{ background: 'rgba(0,0,0,0.5)', padding: '16px', borderRadius: '12px', marginBottom: '8px' }}>
                          <BarcodeScanner 
                            id="circ-user-scanner"
                            onResult={(text) => {
                              setIsCircUserScanning(false);
                              handleLookupStudentFromScanner(text);
                            }} 
                            onError={(err) => console.log('Scanning user...', err)} 
                          />
                        </div>
                      )}
                      
                      {!isCircUserScanning && (
                        <>
                          <div className="sf">
                            <span className="si">🪪</span>
                            <input id="studentIdInput" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }} placeholder="e.g. 22VR1A0501" value={studentId} onChange={e => setStudentId(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') handleLookupStudent(); }} />
                          </div>
                          <button id="studentLookupBtn" className="btn btn-slate btn-sm" style={{ marginTop: '8px', width: '100%' }} onClick={handleLookupStudent}>🔍 Look Up</button>
                        </>
                      )}
                    </div>

                    {!memberData ? (
                      <div id="userInfoCard" style={{ marginTop: '20px' }}>
                        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--slate-300)' }}>
                          <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>👤</div>
                          <div style={{ fontSize: '.83rem' }}>Enter a student/faculty ID to view details</div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="user-id-card">
                           <div className="uid-av">{memberData.firstName.charAt(0)}</div>
                           <div>
                             <div className="uid-name">{memberData.firstName} {memberData.lastName}</div>
                             <div className="uid-role" style={{ fontSize: '.75rem', color: 'var(--slate-500)' }}>{memberData.role}</div>
                             <div className="uid-id">{memberData.userId}</div>
                           </div>
                           <div className="eligibility elig-ok">✓</div>
                        </div>

                        {memberData.held?.length > 0 && (
                          <div id="booksHeldSection" style={{ marginTop: '20px' }}>
                            <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--slate-500)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '8px' }}>Books Currently Held</div>
                            <div id="booksHeldList" className="scanned-list">
                              {memberData.held.map((t: any) => (
                                <div key={t.id} className="scanned-item ok">
                                  <div className="si-ico">📚</div>
                                  <div className="si-info"><div className="si-title">{t.bookTitle}</div><div className="si-sub">Due: {t.due}</div></div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div id="memberHistorySection" style={{ marginTop: '20px' }}>
                          <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--slate-500)', letterSpacing: '.06em', textTransform: 'uppercase', margin: '12px 0 8px' }}>Member Activity Snapshot</div>
                          <div className="history-grid" style={{ display: 'grid', gap: '10px' }}>
                            <div className="card">
                              <div className="card-hdr" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}><div className="card-ttl" style={{ fontSize: '.75rem' }}>Recent History</div></div>
                              <div className="card-body mini-list" style={{ padding: '12px 16px' }}>
                                {memberData.history?.slice(0, 3).map((t: any) => (
                                  <div key={t.id} className="mini-item" style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--surface-2)' }}>
                                    <div className="ttl" style={{ fontSize: '.8rem', fontWeight: 600 }}>{t.bookTitle}</div>
                                    <div className="sub" style={{ fontSize: '.7rem', color: 'var(--slate-500)' }}>{t.status} on {t.checkout || t.returned || 'N/A'}</div>
                                  </div>
                                ))}
                                {(!memberData.history || memberData.history.length === 0) && <div style={{ fontSize: '.75rem', color: 'var(--slate-400)' }}>No history</div>}
                              </div>
                            </div>
                            <div className="card">
                              <div className="card-hdr" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                                <div className="card-ttl" style={{ fontSize: '.75rem' }}>Fine History</div>
                                {memberData.fines?.some((t: any) => t.fineStatus !== 'Waived' && t.fineStatus !== 'Paid') && (
                                  <button onClick={() => { setPendingFineTransactions(memberData.fines.filter((t: any) => t.fineStatus !== 'Waived' && t.fineStatus !== 'Paid')); setFineModalOpen(true); }} className="btn btn-blue btn-sm" style={{ padding: '2px 8px', fontSize: '.7rem' }}>Settle Fines</button>
                                )}
                              </div>
                              <div className="card-body mini-list" style={{ padding: '12px 16px' }}>
                                {memberData.fines?.slice(0, 3).map((t: any) => (
                                  <div key={t.id} className="mini-item" style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--surface-2)' }}>
                                    <div className="ttl" style={{ fontSize: '.8rem', fontWeight: 600 }}>{t.bookTitle}</div>
                                    <div className="sub" style={{ fontSize: '.7rem', color: 'var(--slate-500)' }}>{t.fineStatus || 'Pending'} · ₹{t.fine || 0}</div>
                                  </div>
                                ))}
                                {(!memberData.fines || memberData.fines.length === 0) && <div style={{ fontSize: '.75rem', color: 'var(--slate-400)' }}>No fine history</div>}
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* RIGHT: Book Scan Panel */}
                  <div className="circ-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="circ-panel-ttl" id="bookPanelTitle">📤 Scan Books to {activeMode === 'issue' ? 'Issue' : 'Return'}</div>

                    {/* Mode info banner */}
                    <div id="modeBanner" style={{ background: activeMode === 'issue' ? 'var(--emerald-bg)' : '#eff6ff', border: `1px solid ${activeMode === 'issue' ? 'var(--emerald)' : '#3b82f6'}`, borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: '.8rem', fontWeight: 600, color: activeMode === 'issue' ? 'var(--emerald-dark)' : '#1e40af' }}>
                      {activeMode === 'issue' ? '📤 Issue Mode: Scan ISBNs below to add books to this transaction' : '📥 Return Mode: Scan ISBNs to process returns'}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' }}>
                      {activeMode === 'issue' ? (
                        <div className="fg" style={{ margin: 0 }}>
                          <label className="flbl">Issue Due Date</label>
                          <input className="fc" id="issueDueDate" type="date" value={circDueDate} onChange={(e) => setCircDueDate(e.target.value)} />
                        </div>
                      ) : <div />}
                      <div style={{ display: 'flex', alignItems: 'end' }}>
                        <div style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface-2)', fontSize: '.76rem', color: 'var(--slate-500)' }}>
                          Queue summary and {activeMode === 'issue' ? 'due-date override' : 'fine calculation'} apply to live records.
                        </div>
                      </div>
                    </div>

                    {/* Scan Zone */}
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div className="scan-label" style={{ margin: 0 }}>Scan Book ISBN</div>
                        <button className="btn btn-blue btn-sm" onClick={handleToggleCircBookScanner}>
                          {isCircBookScanning ? 'Stop Camera' : '📷 Use Camera'}
                        </button>
                      </div>
                      
                      {isCircBookScanning ? (
                        <div style={{ background: 'rgba(0,0,0,0.5)', padding: '16px', borderRadius: '12px' }}>
                          <BarcodeScanner 
                            id="circ-book-scanner"
                            onResult={(text) => {
                               setScannedIsbn(text);
                               setIsCircBookScanning(false);
                               handleProcessIsbnFromScanner(text);
                            }} 
                            onError={(err) => console.log('Scanning circ book...', err)} 
                          />
                        </div>
                      ) : (
                        <>
                          <div className="scan-zone" id="scanZone" onClick={() => document.getElementById('isbnInput')?.focus()}>
                            <div className="scan-icon" id="scanZoneIcon">⬛</div>
                            <div className="scan-label" style={{ marginBottom: 0 }}>Click here, then scan barcode or type ISBN</div>
                            <input id="isbnInput" style={{ position: 'absolute', opacity: 0, width: '1px' }} autoComplete="off" value={scannedIsbn} onChange={e => setScannedIsbn(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') handleProcessIsbn(); }} />
                          </div>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <input className="fc" id="manualIsbn" style={{ fontFamily: 'var(--font-mono)', flex: 1 }} placeholder="Or type ISBN manually…" autoComplete="off" value={scannedIsbn} onChange={e => setScannedIsbn(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') handleProcessIsbn(); }} />
                            <button id="bookCircAddBtn" className="btn btn-slate btn-sm" onClick={handleProcessIsbn}>Add</button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Scanned Books */}
                    <div style={{ marginTop: '20px', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--slate-500)', letterSpacing: '.06em', textTransform: 'uppercase' }}>Queued Books</div>
                        <button className="btn btn-outline btn-sm" onClick={() => setQueuedBooks([])}>🗑 Clear All</button>
                      </div>
                      <div id="scannedList" className="scanned-list">
                        {queuedBooks.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--slate-300)', fontSize: '.83rem' }}>No books scanned yet</div>
                        ) : (
                          queuedBooks.map((book, i) => (
                            <div key={i} className="scanned-item ok">
                              <div className="si-ico">📚</div>
                              <div className="si-info"><div className="si-title">{book.title}</div><div className="si-sub">ID: {book.id}</div></div>
                              <button className="si-remove" onClick={() => setQueuedBooks(prev => prev.filter((_, idx) => idx !== i))}>✕</button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Confirm Button */}
                    <button className="btn btn-emerald btn-lg" style={{ width: '100%', marginTop: '16px' }} disabled={!queuedBooks.length || !memberData} onClick={handleConfirmTransaction}>
                      ✅ Confirm Transaction
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* INVENTORY */}
            {activeSection === 'inventory' && (
              <section className="section active" id="sec-inventory">
                <div className="sec-hdr">
                  <div>
                    <h2>Inventory Manager</h2>
                    <p>Scanner-mode quick add · Edit · Mark as Lost/Damaged</p>
                  </div>
                  <button className="btn btn-emerald" onClick={() => { resetForm(); setAddBookModalOpen(true); }}>＋ Add Book (Scanner)</button>
                </div>

                {/* Scanner Add Panel */}
                <div className="inv-scan-wrap">
                  <div className="inv-scan-ttl">
                    <span>📡 Quick-Add Scanner Mode</span>
                    <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,.1)', color: 'rgba(255,255,255,.7)', border: 'none' }} onClick={() => { setScannedIsbn(''); setIsScanning(false); }}>✕ Clear</button>
                  </div>
                  {isScanning ? (
                    <div style={{ background: 'rgba(0,0,0,0.5)', padding: '16px', borderRadius: '12px', marginTop: '16px' }}>
                      <BarcodeScanner 
                        id="inventory-book-scanner"
                        onResult={(text) => {
                          if (isLookingUp) return;
                          setScannedIsbn(text);
                          processScannedIsbn(text);
                        }} 
                        onError={(err) => console.log('Scanning...', err)} 
                      />
                      <button className="btn btn-outline" style={{ marginTop: '16px', width: '100%', borderColor: 'rgba(255,255,255,.2)' }} onClick={() => setIsScanning(false)}>Stop Camera</button>
                    </div>
                  ) : (
                    <>
                      <div className="scanner-label">ISBN — Scan Barcode or Type</div>
                      <div className="scanner-field">
                        <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>⬛</span>
                        <input id="invIsbn" placeholder="Awaiting scan…" autoComplete="off" value={scannedIsbn} onChange={(e) => setScannedIsbn(e.target.value)} onKeyDown={(e) => { 
                          if(e.key === 'Enter' && scannedIsbn) { 
                            processScannedIsbn(scannedIsbn);
                          } 
                        }} />
                        <div className="scanner-cursor"></div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                        <button className="btn btn-emerald" disabled={!scannedIsbn} style={{ opacity: scannedIsbn ? 1 : .5 }} onClick={() => processScannedIsbn(scannedIsbn)}>📚 Search & Add</button>
                        <button className="btn btn-blue" onClick={() => setIsScanning(true)}>📷 Use Camera</button>
                        <button className="btn btn-outline" style={{ background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.5)', borderColor: 'rgba(255,255,255,.1)' }} onClick={() => { resetForm(); setAddBookModalOpen(true); }}>✏️ Full Form</button>
                      </div>
                    </>
                  )}
                </div>

                {/* Filter Toolbar */}
                <div className="toolbar">
                  <div className="sf">
                    <span className="si">🔍</span>
                    <input type="text" placeholder="Search title, author, ISBN…" value={invSearch} onChange={(e) => { setInvSearch(e.target.value); setInvPage(1); }} />
                  </div>
                  <select className="fsel" value={invCat} onChange={(e) => { setInvCat(e.target.value); setInvPage(1); }}>
                    <option value="">All Categories</option>
                    <option>Computer Science</option>
                    <option>Electronics</option>
                    <option>Mathematics</option>
                    <option>Management</option>
                    <option>Physics</option>
                    <option>General Fiction</option>
                    <option>Mechanical</option>
                  </select>
                  <select className="fsel" value={invStatus} onChange={(e) => { setInvStatus(e.target.value); setInvPage(1); }}>
                    <option value="">All Status</option>
                    <option value="Available">Available</option>
                    <option value="Loaned">Loaned Out</option>
                    <option value="Archived">Archived</option>
                    <option value="Lost">Lost</option>
                  </select>
                  <button className="btn btn-outline btn-sm" onClick={runBulkInventoryAction} style={{ background: 'rgba(59, 130, 246, 0.05)', color: 'var(--blue)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
                    🧰 Bulk Actions
                  </button>
                  <span style={{ fontSize: '.78rem', color: 'var(--slate-400)', marginLeft: 'auto' }}>{filteredInventory.length} Books</span>
                </div>

                <div className="card">
                  <div className="tbl-wrap">
                    <table className="dtbl">
                      <thead>
                        <tr>
                          <th>Book</th>
                          <th>Category</th>
                          <th>Total / Avail</th>
                          <th>Location</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedInventory.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>No cloud books found.</td></tr> : 
                          paginatedInventory.map((book) => (
                           <tr key={book.id}>
                             <td><div style={{ fontWeight: 600 }}>{book.title}</div><div style={{ fontSize: '.7rem', color: 'var(--slate-500)' }}>{book.author}</div></td>
                             <td><span className="pill p-slate" style={{ fontSize: '.64rem' }}>{book.category}</span></td>
                             <td><span style={{ fontWeight: 700, color: 'var(--emerald)' }}>{book.availCopies}</span> / {book.totalCopies}</td>
                             <td style={{ fontFamily: 'var(--font-mono)', fontSize: '.75rem', color: 'var(--slate-500)' }}>{book.location}</td>
                             <td><span className={`pill ${book.status === 'Available' ? 'p-green' : book.status === 'Lost' ? 'p-red' : 'p-amber'}`}>{book.status}</span></td>
                             <td style={{ textAlign: 'right' }}>
                               <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                 <button className="btn btn-outline btn-sm" onClick={() => { resetForm(book); setEditBookModalOpen(true); }}>✏️ Edit</button>
                                 <button className="btn btn-outline btn-sm" onClick={async () => {
                                   try {
                                     await updateDoc(doc(db, 'books', book.id), { status: book.status === 'Archived' ? (book.availCopies > 0 ? 'Available' : 'Loaned') : 'Archived' });
                                     toast.success(book.status === 'Archived' ? 'Restored' : 'Archived');
                                   } catch(err) { toast.error('Failed to change status.'); }
                                 }}>{book.status === 'Archived' ? '♻️ Restore' : '📦 Archive'}</button>
                                 <button className="btn btn-danger btn-sm" onClick={() => { setDiscardItem({ id: book.id, title: book.title }); setDiscardModalOpen(true); }}>🗑️ Discard</button>
                               </div>
                             </td>
                           </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="card-foot" style={{ justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '.78rem', color: 'var(--slate-500)' }}>
                      Showing {filteredInventory.length === 0 ? 0 : (invPage - 1) * itemsPerPage + 1}–{Math.min(invPage * itemsPerPage, filteredInventory.length)} of {filteredInventory.length} books
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button 
                        className="btn btn-outline btn-sm" 
                        disabled={invPage === 1} 
                        onClick={() => setInvPage(invPage - 1)}
                        style={{ minWidth: '32px', padding: '4px' }}
                      >‹</button>
                      {Array.from({ length: totalInvPages }, (_, i) => i + 1).map(p => (
                        <button 
                          key={p} 
                          className={`btn btn-sm ${p === invPage ? 'btn-blue' : 'btn-outline'}`} 
                          onClick={() => setInvPage(p)}
                          style={{ minWidth: '32px', padding: '4px' }}
                        >{p}</button>
                      ))}
                      <button 
                        className="btn btn-outline btn-sm" 
                        disabled={invPage === totalInvPages || totalInvPages === 0} 
                        onClick={() => setInvPage(invPage + 1)}
                        style={{ minWidth: '32px', padding: '4px' }}
                      >›</button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* REPORTS */}
            {activeSection === 'reports' && (
              <section className="section active" id="sec-reports">
                <div className="sec-hdr">
                  <div>
                    <h2>Reports & Daily Logs</h2>
                    <p>Issue/Return history, fines, and inventory changes</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-blue print-ok" onClick={() => window.print()}>🖨️ Print to PDF</button>
                    <button className="btn btn-outline" onClick={exportLibrarianCsv}>📥 Export CSV</button>
                  </div>
                </div>

                {/* Date Filters */}
                <div className="rpt-filters">
                  <div className="date-pills">
                    {['Today', 'Last 7 Days', 'This Month', 'Custom Range'].map(dr => (
                      <div key={dr} className={`dpill ${reportDateRange === dr ? 'active' : ''}`} onClick={() => setReportDateRange(dr)}>{dr}</div>
                    ))}
                  </div>
                  {reportDateRange === 'Custom Range' && (
                    <>
                      <input type="date" className="fsel" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} style={{ fontSize: '.78rem' }} />
                      <span style={{ fontSize: '.78rem', color: 'var(--slate-400)' }}>to</span>
                      <input type="date" className="fsel" value={reportTo} onChange={(e) => setReportTo(e.target.value)} style={{ fontSize: '.78rem' }} />
                    </>
                  )}
                  <select className="fsel" value={reportType} onChange={(e) => setReportType(e.target.value)}>
                    <option value="">All Types</option>
                    <option value="Issued">Issued</option>
                    <option value="Returned">Returned</option>
                    <option value="Overdue">Overdue</option>
                    <option value="Lost">Lost / Damaged</option>
                  </select>
                </div>

                {/* Summary Cards */}
                <div className="g3" style={{ marginBottom: '18px' }}>
                  <div className="card">
                    <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ fontSize: '2rem' }}>📤</div>
                      <div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--slate-900)' }}>{filteredTransactions.filter(t => t.status === 'Borrowed').length}</div>
                        <div style={{ fontSize: '.75rem', color: 'var(--slate-500)' }}>Total Issued</div>
                      </div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ fontSize: '2rem' }}>📥</div>
                      <div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--slate-900)' }}>{filteredTransactions.filter(t => t.status === 'Returned').length}</div>
                        <div style={{ fontSize: '.75rem', color: 'var(--slate-500)' }}>Total Returned</div>
                      </div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ fontSize: '2rem' }}>⚖️</div>
                      <div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--red)' }}>₹{filteredTransactions.reduce((acc, t) => acc + (Number(t.fine) || 0), 0)}</div>
                        <div style={{ fontSize: '.75rem', color: 'var(--slate-500)' }}>Fines Displayed</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chart */}
                <div className="g2" style={{ marginBottom: '18px' }}>
                  <div className="card">
                    <div className="card-hdr">
                      <div className="card-ttl">📈 Hourly Activity</div>
                    </div>
                    <div className="card-body">
                      <div className="cw" style={{ height: '220px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={reportChartData}>
                             <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--slate-500)' }} />
                             <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                             <Bar dataKey="count" fill="var(--blue)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="card-hdr">
                      <div className="card-ttl">📊 Transaction Breakdown</div>
                    </div>
                    <div className="card-body">
                      <div className="cw" style={{ height: '220px' }}>
                         <ResponsiveContainer width="100%" height="100%">
                           <BarChart data={[
                             { name: 'Returns', count: filteredTransactions.filter(t => t.status === 'Returned').length },
                             { name: 'Issues', count: filteredTransactions.filter(t => t.status === 'Borrowed').length }
                           ]} layout="vertical">
                              <XAxis type="number" hide />
                              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={60} tick={{ fontSize: 11, fill: 'var(--slate-500)' }} />
                              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                              <Bar dataKey="count" fill="var(--emerald)" radius={[0, 4, 4, 0]} />
                           </BarChart>
                         </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Log Table */}
                <div className="card" id="printableLog">
                  <div className="card-hdr" style={{ marginBottom: 0 }}>
                    <div>
                      <div className="card-ttl">📋 Issue / Return Log</div>
                      <div className="card-sub" id="logDate">{reportDateRange} {filteredTransactions.length} records</div>
                    </div>
                    <div className="sf" style={{ maxWidth: '220px', marginBottom: 0 }}>
                      <span className="si">🔍</span>
                      <input type="text" placeholder="Filter log…" id="rptSearch" value={reportSearch} onChange={(e) => setReportSearch(e.target.value)} />
                    </div>
                  </div>
                  <div className="tbl-wrap">
                    <table className="dtbl">
                      <thead>
                        <tr><th>Txn ID</th><th>User</th><th>Book</th><th>Action Date</th><th>Fine</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {filteredTransactions.map((t) => (
                           <tr key={t.id}>
                             <td style={{ fontFamily: 'var(--font-mono)', fontSize: '.75rem' }}>{t.id.slice(-8)}</td>
                             <td><div style={{ fontWeight: 600 }}>{t.userName}</div></td>
                             <td>{t.bookTitle}</td>
                             <td>{t.checkout || t.returned || 'N/A'}</td>
                             <td>{t.fine > 0 ? `₹${t.fine}` : '-'}</td>
                             <td><span className={`pill ${t.status === 'Borrowed' ? 'p-blue' : t.status === 'Returned' ? 'p-green' : t.status === 'Overdue' ? 'p-red' : 'p-slate'}`}>{t.status}</span></td>
                           </tr>
                        ))}
                        {filteredTransactions.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>No logs yet for this criteria.</td></tr>}
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
