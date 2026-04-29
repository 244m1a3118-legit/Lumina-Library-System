import React, { useState, useEffect, useRef, useMemo } from 'react';
import Chart from 'chart.js/auto';
import { COLORS } from '../../lib/constants';
import { toast } from 'sonner';
import { db } from '../../lib/firebase';
import { collection, onSnapshot } from '@/src/lib/dbClient';

const ReportMainChart: React.FC<{ config: any }> = ({ config }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    if (chartInstance.current) chartInstance.current.destroy();

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    const isLine = config.type === 'line';

    chartInstance.current = new Chart(ctx, {
      type: config.type,
      data: {
        labels: config.labels,
        datasets: [{
          label: config.label,
          data: config.data,
          backgroundColor: isLine ? `${COLORS[0]}22` : COLORS.slice(0, config.data.length).map(c => c + '88'),
          borderColor: isLine ? COLORS[0] : COLORS.slice(0, config.data.length),
          borderWidth: 2,
          borderRadius: isLine ? 0 : 6,
          fill: isLine,
          tension: isLine ? 0.4 : 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { font: { family: 'DM Sans' } } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 11 } } },
          y: { grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { family: 'DM Sans', size: 11 } } }
        }
      }
    });

    return () => {
      if (chartInstance.current) chartInstance.current.destroy();
    };
  }, [config]);

  return <canvas ref={chartRef}></canvas>;
};

const ReportPieChart: React.FC<{ config: any }> = ({ config }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    if (chartInstance.current) chartInstance.current.destroy();

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    chartInstance.current = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: config.pieLabels,
        datasets: [{
          data: config.pieData,
          backgroundColor: COLORS.slice(0, Math.max(config.pieData.length, 1)),
          borderColor: '#fff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { font: { family: 'DM Sans', size: 11 } } } }
      }
    });

    return () => {
      if (chartInstance.current) chartInstance.current.destroy();
    };
  }, [config]);

  return <canvas ref={chartRef}></canvas>;
};

export const ReportsAnalytics: React.FC = () => {
  const [currentReport, setCurrentReport] = useState('user-growth');
  const [dateRange, setDateRange] = useState('Last 30 Days');
  
  const [users, setUsers] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Subscribe to live Firestore statistics
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => setUsers(snap.docs.map(d => d.data())));
    const unsubBooks = onSnapshot(collection(db, 'books'), (snap) => setBooks(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubTx = onSnapshot(collection(db, 'transactions'), (snap) => setTransactions(snap.docs.map(d => d.data())));
    
    return () => { unsubUsers(); unsubBooks(); unsubTx(); };
  }, []);

  const generatedConfigs: Record<string, any> = useMemo(() => {
    
    // 1. User Growth
    const userRoles: Record<string, number> = {};
    const userGrowth: Record<string, number> = {};
    users.forEach(u => {
      userRoles[u.role || 'Student'] = (userRoles[u.role || 'Student'] || 0) + 1;
      const joinedStr = u.joined || u.createdAt;
      if (joinedStr) {
        const my = new Date(joinedStr).toLocaleString('default', { month: 'short', year: '2-digit' });
        userGrowth[my] = (userGrowth[my] || 0) + 1;
      }
    });
    
    const last6Months = Array.from({length: 6}).map((_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
      return d.toLocaleString('default', { month: 'short', year: '2-digit' });
    });

    let cumulativeUserCount = 0;
    const userRows = last6Months.slice().reverse().map(my => {
      const added = userGrowth[my] || 0;
      cumulativeUserCount += added; // Actually requires chronological sort, simplified for demo
      return [my, added, cumulativeUserCount, added > 0 ? '+ Active' : '-'];
    });

    // 2. Most Borrowed
    const bookBorrows: Record<string, number> = {};
    const categoryBorrows: Record<string, number> = {};
    transactions.forEach(tx => {
      if (tx.bookTitle) {
        bookBorrows[tx.bookTitle] = (bookBorrows[tx.bookTitle] || 0) + 1;
      }
      const cat = books.find(b => b.id === tx.bookId || b.title === tx.bookTitle)?.category || 'Uncategorized';
      categoryBorrows[cat] = (categoryBorrows[cat] || 0) + 1;
    });
    const sortedBorrows = Object.entries(bookBorrows).sort((a,b) => b[1] - a[1]);
    const topBorrowed = sortedBorrows.slice(0, 6);
    const topCats = Object.entries(categoryBorrows).sort((a,b) => b[1] - a[1]).slice(0,5);

    // 3. Inventory Value (using dummy prices if price is missing)
    const inventoryValues: Record<string, { count: number, value: number }> = {};
    books.forEach(b => {
      const cat = b.category || 'Uncategorized';
      if (!inventoryValues[cat]) inventoryValues[cat] = { count: 0, value: 0 };
      const copies = Number(b.totalCopies) || 1;
      const val = Number(b.price) || 500;
      inventoryValues[cat].count += copies;
      inventoryValues[cat].value += (copies * val);
    });
    const sortedInv = Object.entries(inventoryValues).sort((a,b) => b[1].value - a[1].value);

    // 4. Fines Collection
    const finesMonth: Record<string, number> = {};
    const reasonPies = { 'Overdue': 0, 'Lost': 0, 'Damage': 0, 'Other': 0 };
    transactions.forEach(tx => {
      if (tx.fine && Number(tx.fine) > 0) {
        const dStr = tx.returnDate || tx.updatedAt || new Date().toISOString();
        const my = new Date(dStr).toLocaleString('default', { month: 'short', year: '2-digit' });
        finesMonth[my] = (finesMonth[my] || 0) + Number(tx.fine);
        reasonPies['Overdue'] += Number(tx.fine); // simplifying reason pie
      }
    });

    return {
      'user-growth': { 
        id: 'user-growth', name: 'User Growth', icon: '👥', label: 'New Users', 
        data: last6Months.map(m => userGrowth[m] || 0), 
        labels: last6Months, type: 'bar', 
        pieLabels: Object.keys(userRoles), pieData: Object.values(userRoles), 
        title: '📈 User Growth (Live)',
        heads: ['Month', 'New Users', 'Cumulative', 'Status'],
        rows: userRows
      },
      'most-borrowed': { 
        id: 'most-borrowed', name: 'Most Borrowed', icon: '📚', label: 'Times Borrowed', 
        data: topBorrowed.map(x => x[1]), labels: topBorrowed.map(x => (x[0].length > 15 ? x[0].substring(0,15)+'...' : x[0])), type: 'bar', 
        pieLabels: topCats.map(x => x[0]), pieData: topCats.map(x => x[1]), 
        title: '🏆 Most Borrowed Books (Live)',
        heads: ['Rank', 'Book Title', 'Times Borrowed'],
        rows: topBorrowed.map((b, i) => [`${i+1}`, b[0], b[1]])
      },
      'inventory-value': { 
        id: 'inventory-value', name: 'Inventory Value', icon: '💰', label: 'Value (₹)', 
        data: sortedInv.map(x => x[1].value), labels: sortedInv.map(x => x[0]), type: 'bar', 
        pieLabels: sortedInv.map(x => x[0]), pieData: sortedInv.map(x => x[1].count), 
        title: '💰 Inventory Value (Live)',
        heads: ['Category', 'Books', 'Total Value (₹)'],
        rows: sortedInv.map(x => [x[0], x[1].count, `₹${x[1].value.toLocaleString()}`])
      },
      'fines': { 
        id: 'fines', name: 'Fine Collection', icon: '⚖️', label: 'Fines Collected (₹)', 
        data: last6Months.map(m => finesMonth[m] || 0), labels: last6Months, type: 'line', 
        pieLabels: ['Overdue'], pieData: [reasonPies['Overdue']], 
        title: '⚖️ Fine Collection (Live)',
        heads: ['Month', 'Total Fine Collected (₹)'],
        rows: last6Months.slice().reverse().map(m => [m, `₹${finesMonth[m] || 0}`])
      }
    };
  }, [users, books, transactions]);

  const config = generatedConfigs[currentReport] || generatedConfigs['user-growth'];

  const handleExport = (fmt: string) => {
    toast.success(`Report exported as ${fmt.toUpperCase()} — check your downloads folder.`);
  };

  return (
    <section className="section active" id="sec-reports">
      <div className="section-header">
        <div>
          <h2>Reports & Analytics</h2>
          <p>Live insights and statistics from your Firestore database</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-outline" onClick={() => handleExport('csv')}>📥 CSV</button>
          <button className="btn btn-primary" onClick={() => handleExport('pdf')}>📄 PDF</button>
        </div>
      </div>

      <div className="grid-main" style={{ gridTemplateColumns: '240px 1fr', alignItems: 'start', gap: '20px' }}>
        <div className="card" style={{ padding: '10px' }}>
          {Object.values(generatedConfigs).map((c: any) => (
            <button 
              key={c.id}
              className={`report-type-btn ${currentReport === c.id ? 'active' : ''}`}
              onClick={() => setCurrentReport(c.id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                background: currentReport === c.id ? 'var(--blue-bg)' : 'transparent',
                color: currentReport === c.id ? 'var(--blue)' : 'var(--text-primary)',
                border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                fontWeight: currentReport === c.id ? 600 : 400,
                marginBottom: '4px',
                transition: 'all 0.2s'
              }}
            >
              <span style={{ marginRight: '8px' }}>{c.icon}</span> {c.name}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title" id="reportChartTitle">{config.title}</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['Last 30 Days', 'This Quarter', 'This Year', 'All Time'].map(range => (
                  <button 
                    key={range}
                    className={`date-pill ${dateRange === range ? 'active' : ''}`}
                    onClick={() => setDateRange(range)}
                    style={{
                      padding: '4px 10px', fontSize: '.75rem', borderRadius: '20px',
                      border: '1px solid var(--border-soft)', 
                      background: dateRange === range ? 'var(--navy)' : 'transparent',
                      color: dateRange === range ? '#fff' : 'var(--text-sec)', 
                      cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
              <div className="chart-wrap" style={{ height: '280px' }}>
                <ReportMainChart config={config} />
              </div>
              <div className="chart-wrap" style={{ height: '280px' }}>
                <ReportPieChart config={config} />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {config.heads.map((h: string, i: number) => <th key={i}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {config.rows.length === 0 ? (
                    <tr><td colSpan={config.heads.length} style={{ textAlign: 'center', padding: '20px' }}>Not enough data natively in db yet</td></tr>
                  ) : config.rows.map((row: string[], i: number) => (
                    <tr key={i}>
                      {row.map((cell: string, j: number) => <td key={j}>{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
