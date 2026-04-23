import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/src/lib/AuthContext';
import { toast } from 'sonner';
import './login.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      toast.error('Please enter your User ID/Email and password');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Context local login 
      login(data.token, data.user);
      toast.success('Logged in successfully!');
      
      const role = data.user.role || 'Student';
      if (role === 'Administrator') {
        navigate('/admin');
      } else if (role === 'Faculty') {
        navigate('/faculty');
      } else if (role === 'Librarian' || role === 'Librarian Desk') {
        navigate('/librarian');
      } else {
        navigate('/student'); // Default fallback is student
      }
      
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'Failed to connect. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-theme">
      {/* Background */}
      <div className="bg">
        <div className="bg-lines"></div>
        <div className="bg-orb bg-orb-1"></div>
        <div className="bg-orb bg-orb-2"></div>
        <div className="bg-orb bg-orb-3"></div>
      </div>

      <div className="page-wrap">
        {/* LEFT PANEL */}
        <div className="left-panel">
          <div className="deco-books">📚</div>

          <div className="left-logo">
            <div className="left-logo-icon">📖</div>
            <div className="left-logo-text">
              Vemu Library
              <span>Institute of Technology (Autonomous)</span>
            </div>
          </div>

          <h1 className="left-headline">
            Your Gateway to<br /><em>Infinite Knowledge</em>
          </h1>
          <p className="left-tagline">
            Access thousands of volumes, research journals, e-books,
            and digital resources curated for academic excellence.
          </p>

          <div className="left-stats">
            <div className="stat">
              <span className="stat-num">55K+</span>
              <span className="stat-lbl">Book Volumes</span>
            </div>
            <div className="stat">
              <span className="stat-num">50K+</span>
              <span className="stat-lbl">E-Resources</span>
            </div>
            <div className="stat">
              <span className="stat-num">24/7</span>
              <span className="stat-lbl">Digital Access</span>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="right-panel">
          <div className="card">
            <div className="view active">
              <h2 className="card-title">Sign-in</h2>
              <p className="card-sub">Access your library account</p>

              <form onSubmit={handleLogin} style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label htmlFor="identifier" style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151', textAlign: 'left' }}>User ID or Email</label>
                  <input
                    id="identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g., 22VR1A0501 or email@vemu.org"
                    disabled={isLoading}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '1rem',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label htmlFor="password" style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151', textAlign: 'left' }}>Password</label>
                    <a href="#" onClick={(e) => {
                      e.preventDefault();
                      toast.info("Please contact your Librarian or Administrator to reset your password.");
                    }} style={{ fontSize: '0.75rem', color: '#4f46e5', textDecoration: 'none', cursor: 'pointer' }}>Forgot password?</a>
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isLoading}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '1rem',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <button 
                  type="submit"
                  className="btn-primary" 
                  disabled={isLoading}
                  style={{ 
                    marginTop: '16px', 
                    padding: '12px 16px',
                    fontSize: '1rem',
                    fontWeight: 600,
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    boxSizing: 'border-box',
                    background: '#1a73e8',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px'
                  }}
                >
                  {isLoading ? 'Authenticating...' : 'Sign in to Account'}
                </button>
              </form>

              <div className="divider"></div>

              <div className="helper-text" style={{ textAlign: 'center', fontSize: '0.75rem' }}>
                By continuing, you are indicating that you accept our Terms of Service and Privacy Policy.
              </div>

              <div className="back-site">
                <Link to="/">← Back to Library Home</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
