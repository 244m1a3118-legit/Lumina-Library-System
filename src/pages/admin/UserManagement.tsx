import React, { useState, useMemo, useEffect } from 'react';
import { ROLE_COLORS } from '../../lib/constants';
import { toast } from 'sonner';
import { db } from '../../lib/firebase';
import { logAudit } from '../../lib/audit';
import { collection, onSnapshot, doc, deleteDoc, updateDoc, setDoc } from '@/src/lib/dbClient';



const formatDate = (d: string) => {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const statusPillMap: Record<string, string> = { Active: 'pill-green', Inactive: 'pill-navy', Suspended: 'pill-red' };
const rolePillMap: Record<string, string> = { Administrator: 'pill-red', Librarian: 'pill-amber', Faculty: 'pill-teal', Student: 'pill-blue' };

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [kebabOpen, setKebabOpen] = useState<string | null>(null);
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', userId: '', email: '', phone: '',
    role: '', password: '', confirmPassword: '', dept: 'Computer Science & Engineering', status: 'Active'
  });

  const usersPerPage = 8;

  // Fetch Users
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(data as any[]);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    return () => unsub();
  }, []);
    

  // Click outside to close kebab
  useEffect(() => {
    const handleClickOutside = () => setKebabOpen(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = !search || `${u.firstName} ${u.lastName} ${u.userId} ${u.email}`.toLowerCase().includes(search.toLowerCase());
      const matchesRole = !roleFilter || u.role === roleFilter;
      const matchesStatus = !statusFilter || u.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const paginatedUsers = filteredUsers.slice((page - 1) * usersPerPage, page * usersPerPage);

  // Handlers
  const handleToggleKebab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setKebabOpen(kebabOpen === id ? null : id);
  };

  const handleDeleteUser = async (id: string) => {
    const u = users.find(x => x.id === id);
    if (window.confirm(`Delete ${u?.firstName} ${u?.lastName}? This action cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, 'users', id));
        await logAudit('DELETE', `Deleted user account: ${u?.firstName}`, 200);
        toast.success('User account deleted.');
      } catch (error) {
        toast.error('Failed to delete user.');
        console.error(error);
      }
    }
  };

  const handleToggleStatus = async (id: string) => {
    const u = users.find(x => x.id === id);
    if (u) {
      const newStatus = u.status === 'Active' ? 'Inactive' : 'Active';
      try {
        await updateDoc(doc(db, 'users', id), { status: newStatus });
        await logAudit('PATCH', `Updated ${u.firstName}'s status to ${newStatus}`, 200);
        toast.success(`${u.firstName}'s account ${newStatus.toLowerCase()}d.`);
      } catch (error) {
        toast.error('Failed to update status');
        console.error(error);
      }
    }
  };

  const handleAssignRole = async (id: string) => {
    const roles = ['Student', 'Faculty', 'Librarian', 'Administrator'];
    const u = users.find(x => x.id === id);
    if (u) {
      const current = roles.indexOf(u.role);
      const next = roles[(current + 1) % roles.length];
      try {
        await updateDoc(doc(db, 'users', id), { role: next });
        await logAudit('PATCH', `Assigned role ${next} to ${u.firstName}`, 200);
        toast.success(`Role updated to ${next} for ${u.firstName}!`);
      } catch (error) {
        toast.error('Failed to assign role');
        console.error(error);
      }
    }
  };

  const handleResetPassword = async (user: any) => {
    const newPassword = window.prompt(`Enter new password for ${user.firstName} ${user.lastName}:`);
    if (!newPassword || newPassword.trim() === '') {
      return;
    }

    try {
      await updateDoc(doc(db, 'users', user.id), { password: newPassword });
      await logAudit('PATCH', `Admin reset password for ${user.email}`, 200);
      toast.success(`Password for ${user.firstName} has been changed successfully.`);
    } catch (error: any) {
      console.error(error);
      toast.error(`Failed to reset password: ${error.message || 'Unknown error'}`);
    }
  };

  const openModal = (user: any = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        firstName: user.firstName || '', lastName: user.lastName || '', userId: user.userId || '',
        email: user.email || '', phone: user.phone || '', role: user.role || '',
        password: '', confirmPassword: '', dept: user.dept || '', status: user.status || 'Active'
      });
    } else {
      setEditingUser(null);
      setFormData({
        firstName: '', lastName: '', userId: '', email: '', phone: '',
        role: '', password: '', confirmPassword: '', dept: 'Computer Science & Engineering', status: 'Active'
      });
    }
    setModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!formData.firstName || !formData.lastName || !formData.userId || !formData.email || !formData.role) {
      toast.error('Please fill all required fields.');
      return;
    }

    try {
      const { confirmPassword, password, ...userData } = formData;
      if (editingUser) {
        if (password && password !== confirmPassword) {
          toast.error("Passwords do not match.");
          return;
        }
        
        // Prepare the payload, keep existing keys intact and just overwrite the form data
        const updatePayload: any = {
          ...userData,
          user_name: `${formData.firstName} ${formData.lastName}`
        };
        if (password) {
          updatePayload.password = password;
        }
        
        await updateDoc(doc(db, 'users', editingUser.id), updatePayload);
        await logAudit('PATCH', `Updated details for ${formData.firstName}`, 200);
        toast.success(`${formData.firstName}'s account updated!`);
      } else {
        if (password && password !== confirmPassword) {
          toast.error("Passwords do not match.");
          return;
        }

        const newUser = {
          ...userData,
          password: password, // Retain password for non-Google flow reference if used
          user_name: `${formData.firstName} ${formData.lastName}`,
          profile: {
            linkedin: "",
            portfolio: "",
            goalText: "",
            motivationalWords: ""
          },
          profileStatus: "Normal",
          joined: new Date().toISOString()
        };
        const newUid = `user-${Date.now()}`;
        await setDoc(doc(db, 'users', newUid), newUser);
        await logAudit('POST', `Created new user ${formData.firstName}`, 200);
        toast.success(`User ${formData.firstName} created successfully!`);
      }
      setModalOpen(false);
    } catch (error) {
      toast.error('Failed to save user.');
      console.error(error);
    }
  };

  return (
    <section className="section active" id="sec-users">
      <div className="section-header">
        <div>
          <h2>User Management</h2>
          <p>Create, update, assign roles, and manage all library accounts</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>＋ Add New User</button>
      </div>

      <div className="toolbar">
        <div className="search-field">
          <span className="ico">🔍</span>
          <input 
            type="text" 
            placeholder="Search by name, ID, or email…" 
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="filter-select" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
          <option value="">All Roles</option>
          <option>Student</option>
          <option>Faculty</option>
          <option>Librarian</option>
          <option>Administrator</option>
        </select>
        <select className="filter-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option>Active</option>
          <option>Inactive</option>
          <option>Suspended</option>
        </select>
        <span style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
          {filteredUsers.length} users
        </span>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="sortable">User ▾</th>
                <th className="sortable">User ID</th>
                <th className="sortable">Role</th>
                <th>Department</th>
                <th className="sortable">Status</th>
                <th className="sortable">Joined</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '20px' }}>Loading users...</td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <div className="es-icon">🔍</div>
                      <p>No users match your criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedUsers.map(u => {
                  const initials = ((u.firstName?.[0] || '') + (u.lastName?.[0] || '')).toUpperCase() || 'U';
                  const rc = ROLE_COLORS[u.role as keyof typeof ROLE_COLORS] || '#888';
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="user-cell">
                          <div className="u-avatar" style={{ background: rc }}>{initials}</div>
                          <div>
                            <div className="u-name">{u.firstName} {u.lastName}</div>
                            <div className="u-email">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: '.78rem', color: 'var(--text-sec)' }}>{u.userId}</span></td>
                      <td><span className={`status-pill ${rolePillMap[u.role] || 'pill-blue'}`}>{u.role}</span></td>
                      <td style={{ fontSize: '.78rem', color: 'var(--text-sec)' }}>{u.dept}</td>
                      <td><span className={`status-pill ${statusPillMap[u.status] || 'pill-navy'}`}>{u.status}</span></td>
                      <td style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>{formatDate(u.joined || new Date().toISOString())}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="kebab-wrap">
                          <button className="kebab-btn" onClick={(e) => handleToggleKebab(e, u.id)}>⋮</button>
                          <div className={`kebab-menu ${kebabOpen === u.id ? 'open' : ''}`}>
                            <div className="kebab-item" onClick={() => openModal(u)}>✏️ Edit Details</div>
                            <div className="kebab-item" onClick={() => handleAssignRole(u.id)}>🎭 Assign Role</div>
                            <div className="kebab-item" onClick={() => handleResetPassword(u)}>🔑 Reset Password</div>
                            <div className="kebab-item" onClick={() => handleToggleStatus(u.id)}>
                              {u.status === 'Active' ? '🚫 Deactivate' : '✅ Activate'}
                            </div>
                            <div className="kebab-divider"></div>
                            <div className="kebab-item danger" onClick={() => handleDeleteUser(u.id)}>🗑️ Delete Account</div>
                          </div>
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
            Showing {filteredUsers.length === 0 ? 0 : (page - 1) * usersPerPage + 1}–{Math.min(page * usersPerPage, filteredUsers.length)} of {filteredUsers.length} users
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
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingUser ? 'Edit User' : 'Add New User'}</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input className="form-control" placeholder="e.g. Ravi" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name *</label>
                  <input className="form-control" placeholder="e.g. Kumar" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">User ID *</label>
                  <input className="form-control" placeholder="e.g. 22VR1A0501" value={formData.userId} onChange={e => setFormData({...formData, userId: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input className="form-control" type="email" placeholder="name@vemu.ac.in" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-control" placeholder="+91 XXXXX XXXXX" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Role *</label>
                  <select className="form-control" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                    <option value="">Select Role</option>
                    <option value="Student">Student</option>
                    <option value="Faculty">Faculty</option>
                    <option value="Librarian">Librarian</option>
                    <option value="Administrator">Administrator</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{editingUser ? 'New Password (Optional)' : 'Password *'}</label>
                  <input className="form-control" type="password" placeholder={editingUser ? "Leave blank to keep unchanged" : "Set login password"} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">{editingUser ? 'Confirm New Password' : 'Confirm Password *'}</label>
                  <input className="form-control" type="password" placeholder="Re-enter password" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select className="form-control" value={formData.dept} onChange={e => setFormData({...formData, dept: e.target.value})}>
                    <option>Computer Science & Engineering</option>
                    <option>Electronics & Communication</option>
                    <option>Mechanical Engineering</option>
                    <option>Civil Engineering</option>
                    <option>Information Technology</option>
                    <option>Mathematics</option>
                    <option>Library & Admin</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-control" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveUser}>💾 Save User</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
