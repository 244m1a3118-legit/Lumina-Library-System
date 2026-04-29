import React from 'react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeSection: string;
  onNavigate: (section: string) => void;
  onProfileClick?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, activeSection, onNavigate, onProfileClick }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠', section: 'Main' },
    { id: 'users', label: 'User Management', icon: '👥', section: 'Management', badge: 3 },
    { id: 'inventory', label: 'Library Inventory', icon: '📖', section: 'Management' },
    { id: 'transactions', label: 'Transactions', icon: '🔄', section: 'Management' },
    { id: 'reports', label: 'Reports & Analytics', icon: '📊', section: 'Analytics' },
    { id: 'system', label: 'System Maintenance', icon: '⚙️', section: 'System' },
    { id: 'audit', label: 'Audit Log', icon: '🔐', section: 'System' },
  ];

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} id="sidebar">
      <button className="sb-toggle" onClick={onToggle} title="Collapse sidebar">◀</button>

      <div className="sb-header">
        <div className="sb-logo-icon">📚</div>
        <div className="sb-logo-text">
          Vemu Library<small>Admin Control Panel</small>
        </div>
      </div>

      <nav className="sb-nav">
        {['Main', 'Management', 'Analytics', 'System'].map((sectionTitle) => (
          <React.Fragment key={sectionTitle}>
            <div className="sb-section-label">{sectionTitle}</div>
            {navItems.filter(item => item.section === sectionTitle).map((item) => (
              <div 
                key={item.id}
                className={`sb-item ${activeSection === item.id ? 'active' : ''}`} 
                onClick={() => onNavigate(item.id)}
              >
                <div className="icon">{item.icon}</div>
                <span className="label">{item.label}</span>
                {item.badge && <span className="sb-badge">{item.badge}</span>}
              </div>
            ))}
          </React.Fragment>
        ))}
      </nav>

      <div className="sb-footer">
        <div className="sb-user" onClick={onProfileClick} style={{ cursor: 'pointer' }}>
          <div className="sb-avatar">SA</div>
          <div className="sb-user-info">
            <div className="sb-user-name">Super Admin</div>
            <div className="sb-user-role">Administrator</div>
          </div>
        </div>
      </div>
    </aside>
  );
};
