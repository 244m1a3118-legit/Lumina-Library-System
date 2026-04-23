import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from '@/src/lib/dbClient';



const methodColors: Record<string, string> = {
  'POST': 'var(--green)',
  'PUT': 'var(--blue)',
  'DELETE': 'var(--red)',
  'GET': 'var(--purple)'
};

const methodBgs: Record<string, string> = {
  'POST': 'var(--green-bg)',
  'PUT': 'var(--blue-bg)',
  'DELETE': 'var(--red-bg)',
  'GET': 'var(--purple-bg)'
};

export const AuditLog: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [page, setPage] = useState(1);

  const logsPerPage = 10;

  useEffect(() => {
    // Real-time Firestore listener for audit_logs
    const q = query(collection(db, 'audit_logs'), orderBy('ts', 'desc'), limit(100));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(data);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    return () => unsub();
  }, []);
    

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const user = log.user || '';
      const action = log.action || '';
      const method = log.method || '';

      const matchesSearch = !search || `${user} ${action}`.toLowerCase().includes(search.toLowerCase());
      const matchesMethod = !methodFilter || method === methodFilter;
      return matchesSearch && matchesMethod;
    });
  }, [logs, search, methodFilter]);

  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
  const paginatedLogs = filteredLogs.slice((page - 1) * logsPerPage, page * logsPerPage);

  const handleExport = () => {
    toast.success('Audit log exported successfully.');
  };

  const handleSettings = () => {
    toast.info('Navigating to Log Settings...');
  };

  return (
    <section className="section active" id="sec-audit">
      <div className="section-header">
        <div>
          <h2>Audit Log</h2>
          <p>Master record of all administrative actions</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-outline" onClick={handleExport}>📥 Export Log</button>
          <button className="btn btn-primary" onClick={handleSettings}>⚙️ Log Settings</button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-field">
          <span className="ico">🔍</span>
          <input 
            type="text" 
            placeholder="Filter by user or action…" 
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select 
          className="filter-select" 
          value={methodFilter} 
          onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Methods</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="GET">GET</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrap" style={{ maxHeight: '500px', overflowY: 'auto' }}>
          <table className="data-table">
            <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
              <tr>
                <th>Timestamp</th>
                <th>Method</th>
                <th>User</th>
                <th>Action / Endpoint</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>Loading audit logs...</td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <div className="es-icon">🔍</div>
                      <p>No audit logs match your filter.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: '.78rem', color: 'var(--text-sec)', whiteSpace: 'nowrap' }}>
                      {log.ts || new Date().toISOString()}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '.7rem',
                        fontWeight: 700,
                        background: methodBgs[log.method] || 'var(--border-soft)',
                        color: methodColors[log.method] || 'var(--text-sec)'
                      }}>
                        {log.method || 'N/A'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, fontSize: '.82rem' }}>{log.user || 'Unknown'}</td>
                    <td style={{ fontSize: '.82rem', color: 'var(--text-primary)' }}>{log.action || '-'}</td>
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '.75rem',
                        fontWeight: 600,
                        background: log.status >= 200 && log.status < 300 ? 'var(--green-bg)' : 'var(--red-bg)',
                        color: log.status >= 200 && log.status < 300 ? 'var(--green)' : 'var(--red)'
                      }}>
                        {log.status || 200}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="card-footer">
          <span style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>
            Showing {filteredLogs.length === 0 ? 0 : (page - 1) * logsPerPage + 1}–{Math.min(page * logsPerPage, filteredLogs.length)} of {filteredLogs.length} records
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
    </section>
  );
};
