import React, { createContext, useContext, useEffect, useState } from 'react';

export interface CustomUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: CustomUser | null;
  loading: boolean;
  logout: () => void;
  login: (token: string, userData: any) => void;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, logout: () => {}, login: () => {} });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('library_token');
    if (!token) {
      setLoading(false);
      return;
    }

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.user) {
        setUser({
          uid: data.user.id,
          email: data.user.email,
          displayName: data.user.user_name || data.user.firstName,
          role: data.user.role,
          ...data.user
        });
      } else {
        localStorage.removeItem('library_token');
      }
    })
    .catch(() => localStorage.removeItem('library_token'))
    .finally(() => setLoading(false));
  }, []);

  const login = (token: string, userData: any) => {
    localStorage.setItem('library_token', token);
    const displayName = userData.user_name || userData.firstName || userData.email || 'System';
    localStorage.setItem('library_user_name', displayName);
    setUser({
      uid: userData.id,
      email: userData.email,
      displayName: displayName,
      role: userData.role,
      ...userData
    });
  };

  const logout = () => {
    localStorage.removeItem('library_token');
    localStorage.removeItem('library_user_name');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, login }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
