import React, { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { COLORS } from '../../lib/constants';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query } from '@/src/lib/dbClient';

export const TrendChart: React.FC = () => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const [data, setData] = useState<{ labels: string[], issued: number[], returned: number[] }>({ labels: [], issued: [], returned: [] });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'transactions'), (snap) => {
      const issuesByMonth: Record<string, number> = {};
      const returnsByMonth: Record<string, number> = {};

      snap.docs.forEach(doc => {
        const item = doc.data();
        // Assuming item has issuedDate and returnDate or similar. We fall back to createdAt if missing.
        const issuedDateStr = item.issuedDate || item.date || item.createdAt;
        if (issuedDateStr) {
          const d = new Date(issuedDateStr);
          const monthYear = d.toLocaleString('default', { month: 'short', year: '2-digit' });
          issuesByMonth[monthYear] = (issuesByMonth[monthYear] || 0) + 1;
        }

        if (item.status === 'Returned' || item.returnDate) {
          const retStr = item.returnDate || item.updatedAt;
          if (retStr) {
            const d = new Date(retStr);
            const monthYear = d.toLocaleString('default', { month: 'short', year: '2-digit' });
            returnsByMonth[monthYear] = (returnsByMonth[monthYear] || 0) + 1;
          }
        }
      });

      // To keep it simple, we use the last 6 months
      const labels = [];
      const issued = [];
      const returned = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const my = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        labels.push(my);
        issued.push(issuesByMonth[my] || 0);
        returned.push(returnsByMonth[my] || 0);
      }
      setData({ labels, issued, returned });
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels.length > 0 ? data.labels : ['No Data'],
        datasets: [
          {
            label: 'Issued', 
            data: data.issued.length > 0 ? data.issued : [0],
            borderColor: COLORS[0], 
            backgroundColor: 'rgba(59,130,246,.1)',
            tension: 0.4, 
            fill: true, 
            pointRadius: 4, 
            pointBackgroundColor: COLORS[0]
          },
          {
            label: 'Returned', 
            data: data.returned.length > 0 ? data.returned : [0],
            borderColor: COLORS[2], 
            backgroundColor: 'rgba(20,184,166,.08)',
            tension: 0.4, 
            fill: true, 
            pointRadius: 4, 
            pointBackgroundColor: COLORS[2]
          },
        ]
      },
      options: {
        responsive: true, 
        maintainAspectRatio: false,
        plugins: { 
          legend: { 
            position: 'top', 
            labels: { font: { family: 'DM Sans', size: 12 }, usePointStyle: true } 
          } 
        },
        scales: {
          x: { grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { family: 'DM Sans', size: 11 } } },
          y: { grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { family: 'DM Sans', size: 11 }, precision: 0 } }
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data]);

  return <canvas ref={chartRef}></canvas>;
};

export const CategoryChart: React.FC = () => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const [data, setData] = useState<{ labels: string[], counts: number[] }>({ labels: [], counts: [] });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'books'), (snap) => {
      const catCounts: Record<string, number> = {};
      snap.docs.forEach(doc => {
        const cat = doc.data().category || 'Uncategorized';
        catCounts[cat] = (catCounts[cat] || 0) + 1;
      });

      const sorted = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
      const top5 = sorted.slice(0, 5);
      const others = sorted.slice(5).reduce((acc, val) => acc + val[1], 0);

      const labels = top5.map(x => x[0]);
      const counts = top5.map(x => x[1]);
      if (others > 0) {
        labels.push('Others');
        counts.push(others);
      }

      setData({ labels, counts });
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    chartInstance.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.labels.length > 0 ? data.labels : ['No Data'],
        datasets: [{
          data: data.counts.length > 0 ? data.counts : [1], 
          backgroundColor: COLORS.slice(0, Math.max(data.labels.length, 1)),
          borderColor: '#fff', 
          borderWidth: 2
        }]
      },
      options: {
        responsive: true, 
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: { 
          legend: { 
            position: 'right', 
            labels: { font: { family: 'DM Sans', size: 11 }, usePointStyle: true, padding: 12 } 
          } 
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data]);

  return <canvas ref={chartRef}></canvas>;
};
