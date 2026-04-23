import React from 'react';
import { useAuth } from '../../lib/AuthContext';
import { toast } from 'sonner';
import { NotificationBell } from '../../components/NotificationBell';

interface TopbarProps {
  title: string;
  icon: string;
}

export const Topbar: React.FC<TopbarProps> = ({ title, icon }) => {
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      logout();
    } catch (e) {
      toast.error('Failed to log out.');
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-title">
        <span className="page-icon">{icon}</span>
        <span>{title}</span>
        <span className="topbar-breadcrumb">/ Overview</span>
      </div>
      <div className="topbar-spacer"></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <NotificationBell />
        <button className="topbar-btn" title="Logout" onClick={handleLogout} style={{ fontSize: '1.2rem', padding: '8px', cursor: 'pointer', background: 'none', border: 'none' }}>🚪</button>
      </div>
    </header>
  );
};
