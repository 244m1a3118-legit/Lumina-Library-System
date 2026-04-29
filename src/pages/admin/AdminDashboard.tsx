import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { TrendChart, CategoryChart } from './Charts';
import { UserManagement } from './UserManagement';
import { InventoryManagement } from './InventoryManagement';
import { TransactionManagement } from './TransactionManagement';
import { ReportsAnalytics } from './ReportsAnalytics';
import { SystemMaintenance } from './SystemMaintenance';
import { AuditLog } from './AuditLog';
import { ProfileModal } from '../../components/ProfileModal';


import { useAuth } from '../../lib/AuthContext';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, where, doc, updateDoc } from '@/src/lib/dbClient';
import { toast } from 'sonner';
import { logAudit } from '../../lib/audit';
import './admin.css';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [currentTime, setCurrentTime] = useState('');
  
  const [stats, setStats] = useState({ totalUsers: 0, totalBooks: 0, activeLoans: 0, overdueCount: 0 });
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  useEffect(() => {
    const updateClock = () => {
      const d = new Date();
      setCurrentTime(
        d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) +
        ' · ' + d.toLocaleTimeString('en-IN')
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => setStats(s => ({ ...s, totalUsers: snap.size })));
    const unsubBooks = onSnapshot(collection(db, 'books'), (snap) => setStats(s => ({ ...s, totalBooks: snap.size })));
    const unsubTx = onSnapshot(collection(db, 'transactions'), (snap) => {
      let active = 0;
      let overdue = 0;
      snap.forEach(d => {
        const t = d.data();
        if (t.status === 'Borrowed' || t.status === 'Overdue') active++;
        if (t.status === 'Overdue' || new Date(t.due) < new Date()) overdue++;
      });
      setStats(s => ({ ...s, activeLoans: active, overdueCount: overdue }));
    });

    const auditQuery = query(collection(db, 'audit_logs'), orderBy('ts', 'desc'), limit(8));
    const unsubAudit = onSnapshot(auditQuery, (snap) => {
      const logs = snap.docs.map(docSnap => {
        const item = docSnap.data();
        return {
          id: docSnap.id,
          icon: '⚡',
          color: 'var(--blue)',
          text: `<span>${item.user || 'System'}</span> ${item.action || 'performed an action'}`,
          meta: new Date(item.ts).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };
      });
      setActivityFeed(logs);
    });

    // Pull pending approvals from both procurements and bulkRequests
    const procQuery = query(collection(db, 'procurements'), where('status', '==', 'Pending'));
    const bulkQuery = query(collection(db, 'bulkRequests'), where('status', '==', 'Pending'));
    
    const unsubProc = onSnapshot(procQuery, (snap) => {
      const procs = snap.docs.map(d => ({ 
        id: d.id, 
        ...d.data(), 
        collectionName: 'procurements',
        displayTitle: d.data().title || 'Book Request',
        displayAuthor: d.data().creatorName || 'Faculty',
        amount: '-'
      }));
      setPendingApprovals(prev => {
        const filtered = prev.filter(p => p.collectionName !== 'procurements');
        return [...filtered, ...procs].slice(0, 5); // Limit to 5 total for feed
      });
    });

    const unsubBulk = onSnapshot(bulkQuery, (snap) => {
      const bulks = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        collectionName: 'bulkRequests',
        displayTitle: d.data().bookTitle || 'Bulk Request',
        displayAuthor: d.data().creatorName || 'Faculty',
        amount: `${d.data().copies || 1} copies`
      }));
      setPendingApprovals(prev => {
        const filtered = prev.filter(p => p.collectionName !== 'bulkRequests');
        return [...filtered, ...bulks].slice(0, 5);
      });
    });
    
    return () => {
      unsubUsers(); unsubBooks(); unsubTx(); unsubAudit(); unsubProc(); unsubBulk();
    };
  }, [user]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success('Live connection synchronized via Firebase.');
    }, 800);
  };

  const handleProcessApproval = async (id: string, collectionName: string, action: string) => {
    try {
      await updateDoc(doc(db, collectionName, id), { status: action, updatedAt: new Date().toISOString() });
      toast.success(`Request marked as ${action}`);
      await logAudit('POST', `${action} pending request in ${collectionName}`, 200);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status');
    }
  };
    

  if (!user) {
    return <Navigate to="/login" replace />;
  }


  const navItems = {
    dashboard: { title: 'Dashboard', icon: '🏠' },
    users: { title: 'User Management', icon: '👥' },
    inventory: { title: 'Library Inventory', icon: '📖' },
    transactions: { title: 'Transactions', icon: '🔄' },
    reports: { title: 'Reports & Analytics', icon: '📊' },
    system: { title: 'System Maintenance', icon: '⚙️' },
    audit: { title: 'Audit Log', icon: '🔐' },
  };

  const systemServices = [
    { name: 'Web Server (Nginx)', status: 'Active', pill: 'pill-green', pulse: 'pulse-green' },
    { name: 'Database (MySQL)', status: 'Active', pill: 'pill-green', pulse: 'pulse-green' },
    { name: 'Backup Service', status: 'Active', pill: 'pill-green', pulse: 'pulse-green' },
    { name: 'Email Notification', status: 'Active', pill: 'pill-green', pulse: 'pulse-green' },
    { name: 'Search Index', status: 'Indexing', pill: 'pill-amber', pulse: 'pulse-amber' },
    { name: 'SSL Certificate', status: 'Valid', pill: 'pill-blue', pulse: 'pulse-green' },
  ];

  return (
    <div>
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
      <div className="app">
        <Sidebar 
          collapsed={collapsed} 
          onToggle={() => setCollapsed(!collapsed)} 
          activeSection={activeSection}
          onNavigate={setActiveSection}
          onProfileClick={() => setIsProfileModalOpen(true)}
        />
        
        <div className="main">
          <Topbar 
            title={navItems[activeSection as keyof typeof navItems].title} 
            icon={navItems[activeSection as keyof typeof navItems].icon} 
          />
          
          <div className="content">
            {activeSection === 'dashboard' && (
              <section className="section active">
                <div className="section-header">
                  <div>
                    <h2>Smart Dashboard</h2>
                    <p>Real-time overview of your library system — <span>{currentTime}</span></p>
                  </div>
                  <button className="btn btn-gold" onClick={handleRefresh} disabled={isRefreshing}>
                    {isRefreshing ? '↻ Syncing...' : '↻ Refresh'}
                  </button>
                </div>

                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-top">
                      <div className="stat-icon" style={{ background: 'var(--blue-bg)' }}>👥</div>
                      <span className="stat-trend trend-up">▲ 12%</span>
                    </div>
                    <div className="stat-num">{stats.totalUsers}</div>
                    <div className="stat-label">Total Users</div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: '78%', background: 'var(--blue)' }}></div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-top">
                      <div className="stat-icon" style={{ background: 'var(--amber-bg)' }}>📚</div>
                      <span className="stat-trend trend-up">▲ 5%</span>
                    </div>
                    <div className="stat-num">{stats.totalBooks}</div>
                    <div className="stat-label">Total Books</div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: '92%', background: 'var(--amber)' }}></div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-top">
                      <div className="stat-icon" style={{ background: 'var(--green-bg)' }}>🔄</div>
                      <span className="stat-trend trend-neu">→ 0%</span>
                    </div>
                    <div className="stat-num">{stats.activeLoans}</div>
                    <div className="stat-label">Active Loans</div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: '31%', background: 'var(--green)' }}></div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-top">
                      <div className="stat-icon" style={{ background: 'var(--red-bg)' }}>⏰</div>
                      <span className="stat-trend trend-down">▼ 3</span>
                    </div>
                    <div className="stat-num">{stats.overdueCount}</div>
                    <div className="stat-label">Overdue Books</div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: '18%', background: 'var(--red)' }}></div>
                    </div>
                  </div>
                </div>

                <div className="grid-main" style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="card">
                      <div className="card-header">
                        <div>
                          <div className="card-title">📈 Monthly Loan Trend</div>
                          <div className="card-subtitle">Books issued vs returned (last 6 months)</div>
                        </div>
                        <select className="filter-select" style={{ fontSize: '.75rem', padding: '5px 8px' }}>
                          <option>Last 6 Months</option>
                          <option>Last 12 Months</option>
                          <option>This Year</option>
                        </select>
                      </div>
                      <div className="card-body">
                        <div className="chart-wrap" style={{ height: '260px' }}>
                          <TrendChart />
                        </div>
                      </div>
                    </div>

                    <div className="card">
                      <div className="card-header">
                        <div>
                          <div className="card-title">⚡ Live Activity Feed</div>
                          <div className="card-subtitle">Last 8 system actions</div>
                        </div>
                        <button className="btn btn-outline btn-sm">Load More</button>
                      </div>
                      <div className="card-body" style={{ paddingTop: '8px' }}>
                        <div className="feed-list">
                          {activityFeed.length > 0 ? activityFeed.map((item, i) => (
                            <div className="feed-item" key={i}>
                              <div className="feed-dot" style={{ background: item.color }}></div>
                              <div>
                                <div className="feed-text" dangerouslySetInnerHTML={{ __html: `${item.icon} ${item.text}` }}></div>
                                <div className="feed-meta">{item.meta}</div>
                              </div>
                            </div>
                          )) : (
                            <p style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>No recent activity.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="card">
                      <div className="card-header">
                        <div className="card-title">🖥️ System Status</div>
                      </div>
                      <div className="card-body">
                        <div className="status-list">
                          {systemServices.map((s, i) => (
                            <div className="status-row" key={i}>
                              <span className="status-name"><span className={`pulse ${s.pulse}`}></span>{s.name}</span>
                              <span className={`status-pill ${s.pill}`}>{s.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="card">
                      <div className="card-header">
                        <div>
                          <div className="card-title">⏳ Pending Approvals</div>
                          <div className="card-subtitle">{pendingApprovals.length} items need attention</div>
                        </div>
                        <button className="btn btn-outline btn-sm">View All</button>
                      </div>
                      <div className="card-body" style={{ paddingTop: '8px' }}>
                        <div>
                          {pendingApprovals.length > 0 ? pendingApprovals.slice(0, 4).map((p, i) => (
                            <div className="approval-item" key={p.id || i}>
                              <div className="approval-icon" style={{ background: 'var(--amber-bg)' }}>📋</div>
                              <div className="approval-info">
                                <div className="approval-title">{p.displayTitle}</div>
                                <div className="approval-sub">By {p.displayAuthor} • {p.amount}</div>
                              </div>
                              <div className="approval-actions">
                                <button className="btn btn-sm" onClick={() => handleProcessApproval(p.id, p.collectionName, 'Approved')} style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid rgba(34,197,94,.2)' }}>✓</button>
                                <button className="btn btn-sm btn-danger" onClick={() => handleProcessApproval(p.id, p.collectionName, 'Rejected')}>✕</button>
                              </div>
                            </div>
                          )) : (
                            <p style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>No pending approvals.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="card">
                      <div className="card-header">
                        <div className="card-title">📊 Books by Category</div>
                      </div>
                      <div className="card-body">
                        <div className="chart-wrap" style={{ height: '200px' }}>
                          <CategoryChart />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'users' && <UserManagement />}
            {activeSection === 'inventory' && <InventoryManagement />}
            {activeSection === 'transactions' && <TransactionManagement />}
            {activeSection === 'reports' && <ReportsAnalytics />}
            {activeSection === 'system' && <SystemMaintenance />}
            {activeSection === 'audit' && <AuditLog />}

            {activeSection !== 'dashboard' && activeSection !== 'users' && activeSection !== 'inventory' && activeSection !== 'transactions' && activeSection !== 'reports' && activeSection !== 'system' && activeSection !== 'audit' && (
              <section className="section active">
                <div className="section-header">
                  <div>
                    <h2>{navItems[activeSection as keyof typeof navItems].title}</h2>
                    <p>This section is being integrated with the backend API...</p>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
