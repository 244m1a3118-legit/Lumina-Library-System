import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { doc, getDoc, updateDoc } from '@/src/lib/dbClient';
import { signOut } from 'firebase/auth';
import { useAuth } from '../lib/AuthContext';
import { toast } from 'sonner';

export const ProfileModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const [userData, setUserData] = useState<any>(null);
  const [formData, setFormData] = useState({ linkedin: '', portfolio: '', goalText: '', motivationalWords: '', newPassword: '', confirmPassword: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      getDoc(doc(db, 'users', user.uid)).then(d => {
        if (d.exists()) {
          const data = d.data();
          setUserData(data);
          setFormData({
            linkedin: data.profile?.linkedin || '',
            portfolio: data.profile?.portfolio || '',
            goalText: data.profile?.goalText || '',
            motivationalWords: data.profile?.motivationalWords || '',
            newPassword: '',
            confirmPassword: ''
          });
        }
      });
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const profile = userData?.profile || {};
  const statusClass = (status: string) => {
    const s = String(status || 'normal').toLowerCase();
    if (s === 'active') return 'elite';
    return s;
  };

  const handleSave = async () => {
    setIsSaving(true);
    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      toast.error('Passwords do not match.');
      setIsSaving(false);
      return;
    }
    
    try {
      const profileUpdates = {
        linkedin: formData.linkedin.trim(),
        portfolio: formData.portfolio.trim(),
        goalText: formData.goalText.trim(),
        motivationalWords: formData.motivationalWords.trim()
      };
      
      const payload: any = { profile: profileUpdates };
      if (formData.newPassword) {
        payload.password = formData.newPassword;
      }
      
      await updateDoc(doc(db, 'users', user.uid), payload);
      setUserData((prev: any) => ({ ...prev, profile: profileUpdates }));
      toast.success('Profile updated successfully.');
      setTimeout(() => onClose(), 700);
    } catch (e) {
      toast.error('Unable to save profile.');
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      logout();
      onClose();
    } catch (e) {
      toast.error('Logout failed.');
    }
  };

  const displayName = userData?.firstName ? `${userData.firstName} ${userData.lastName}` : (userData?.user_name || user.email?.split('@')[0]);

  return (
    <div className="profile-ovl open" onClick={onClose}>
      <style>{`
        .profile-ovl {
          position: fixed;
          inset: 0;
          background:
            radial-gradient(circle at top right, rgba(251, 191, 36, .15), transparent 28%),
            radial-gradient(circle at bottom left, rgba(59, 130, 246, .14), transparent 26%),
            rgba(15, 23, 42, .52);
          backdrop-filter: blur(12px);
          display: none;
          align-items: center;
          justify-content: center;
          z-index: 1400;
          padding: 20px;
        }
        .profile-ovl.open { display: flex; }
        .profile-card {
          width: min(760px, 100%);
          max-height: 88vh;
          overflow: auto;
          background:
            linear-gradient(145deg, rgba(255,255,255,.96), rgba(248,250,252,.94));
          border-radius: 28px;
          box-shadow: 0 30px 80px rgba(15, 23, 42, .24);
          border: 1px solid rgba(255, 255, 255, .45);
          position: relative;
        }
        .profile-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at top right, rgba(251,191,36,.18), transparent 24%),
            radial-gradient(circle at bottom left, rgba(59,130,246,.12), transparent 26%);
          pointer-events: none;
        }
        .profile-head {
          padding: 24px 24px 16px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          border-bottom: 1px solid rgba(148, 163, 184, .16);
          position: relative;
          z-index: 1;
        }
        .profile-title {
          font-size: 1.3rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -.02em;
        }
        .profile-sub {
          margin-top: 4px;
          color: #64748b;
          font-size: .82rem;
        }
        .profile-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 10px;
          padding: 7px 12px;
          border-radius: 999px;
          font-size: .72rem;
          font-weight: 800;
          letter-spacing: .02em;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.35);
        }
        .profile-status.normal { background: #e2e8f0; color: #334155; }
        .profile-status.elite { background: #dbeafe; color: #1d4ed8; }
        .profile-status.gold { background: #fef3c7; color: #b45309; }
        .profile-status.platinum { background: #ede9fe; color: #6d28d9; }
        .profile-close {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 1px solid rgba(148, 163, 184, .25);
          background: rgba(255,255,255,.75);
          cursor: pointer;
        }
        .profile-body {
          padding: 22px 24px;
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          gap: 20px;
          position: relative;
          z-index: 1;
        }
        .profile-panel {
          background: rgba(255,255,255,.75);
          border: 1px solid rgba(148, 163, 184, .16);
          border-radius: 18px;
          padding: 18px;
        }
        .profile-label {
          font-size: .7rem;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: #64748b;
          margin-bottom: 6px;
        }
        .profile-value {
          color: #0f172a;
          font-size: .88rem;
          line-height: 1.5;
          word-break: break-word;
          margin-bottom: 10px;
        }
        .profile-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .profile-form input,
        .profile-form textarea {
          width: 100%;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, .26);
          background: rgba(255,255,255,.88);
          font: inherit;
          color: #0f172a;
          transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
        }
        .profile-form input:focus,
        .profile-form textarea:focus {
          outline: none;
          border-color: rgba(59, 130, 246, .55);
          box-shadow: 0 0 0 4px rgba(59, 130, 246, .12);
          transform: translateY(-1px);
        }
        .profile-form textarea {
          min-height: 102px;
          resize: vertical;
        }
        .profile-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 0 24px 24px;
          position: relative;
          z-index: 1;
        }
        .profile-btn {
          padding: 10px 16px;
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, .22);
          background: rgba(255,255,255,.82);
          cursor: pointer;
          font-weight: 700;
          transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
        }
        .profile-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 18px rgba(15, 23, 42, .08);
        }
        .profile-btn.primary {
          background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%);
          color: #fff;
          border-color: transparent;
        }
        @media (max-width: 760px) {
          .profile-body { grid-template-columns: 1fr; }
        }
      `}</style>
      
      <div className="profile-card" onClick={e => e.stopPropagation()}>
        <div className="profile-head">
          <div>
            <div className="profile-title">{displayName}</div>
            <div className="profile-sub">{user.email} · {userData?.userId || user.uid.substring(0, 8)} · {userData?.role || 'User'}</div>
            <div className={`profile-status ${statusClass(userData?.status)}`}>
              Profile Status: {userData?.status || 'Normal'}
            </div>
          </div>
          <button className="profile-close" type="button" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        
        <div className="profile-body">
          <div className="profile-panel">
            <div className="profile-label">Account Details</div>
            <div className="profile-value"><strong>Department:</strong> {userData?.dept || '-'}</div>
            <div className="profile-value"><strong>Phone:</strong> {userData?.phone || '-'}</div>
            <div className="profile-value"><strong>Joined:</strong> {userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString() : 'N/A'}</div>
            
            <div className="profile-value" style={{ marginTop: '10px' }}><strong>LinkedIn:</strong> {profile.linkedin || '-'}</div>
            <div className="profile-value"><strong>Portfolio:</strong> {profile.portfolio || '-'}</div>
            
            <div className="profile-label" style={{ marginTop: '16px' }}>My Goal</div>
            <div className="profile-value">{profile.goalText || 'No goal added yet.'}</div>
            
            <div className="profile-label" style={{ marginTop: '16px' }}>Motivational Words</div>
            <div className="profile-value">{profile.motivationalWords || 'No motivational words added yet.'}</div>
          </div>
          
          <div className="profile-panel">
            <div className="profile-label">Edit My Profile</div>
            <form className="profile-form" onSubmit={e => { e.preventDefault(); handleSave(); }}>
              <input 
                placeholder="LinkedIn URL" 
                value={formData.linkedin} 
                onChange={e => setFormData({...formData, linkedin: e.target.value})} 
              />
              <input 
                placeholder="Portfolio URL" 
                value={formData.portfolio} 
                onChange={e => setFormData({...formData, portfolio: e.target.value})} 
              />
              <textarea 
                placeholder="Write your current goal" 
                value={formData.goalText} 
                onChange={e => setFormData({...formData, goalText: e.target.value})} 
              />
              <textarea 
                placeholder="Add motivational words for your profile" 
                value={formData.motivationalWords} 
                onChange={e => setFormData({...formData, motivationalWords: e.target.value})} 
              />
              
              <div className="profile-label" style={{ marginTop: '16px' }}>Change Password</div>
              <input 
                type="password"
                placeholder="New Password (optional)" 
                value={formData.newPassword} 
                onChange={e => setFormData({...formData, newPassword: e.target.value})} 
              />
              <input 
                type="password"
                placeholder="Confirm New Password" 
                value={formData.confirmPassword} 
                onChange={e => setFormData({...formData, confirmPassword: e.target.value})} 
              />
            </form>
          </div>
        </div>
        
        <div className="profile-actions">
          <button className="profile-btn" type="button" onClick={handleLogout}>Logout</button>
          <button className="profile-btn" type="button" onClick={onClose}>Cancel</button>
          <button className="profile-btn primary" type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};
