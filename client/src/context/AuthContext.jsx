import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('ch_access_token');
      if (token) {
        try {
          const { data } = await api.get('/auth/me');
          setUser(data.user);
        } catch (err) {
          localStorage.removeItem('ch_access_token');
          setUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (identifier, password) => {
    const { data } = await api.post('/auth/login', { identifier, password });
    localStorage.setItem('ch_access_token', data.accessToken);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {}
    localStorage.removeItem('ch_access_token');
    setUser(null);
  };

  const updatePassword = async (newPassword, currentPassword) => {
    await api.post('/auth/change-password', { newPassword, currentPassword });
    setUser((prev) => (prev ? { ...prev, passwordChanged: true } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        updatePassword,
        isAuthenticated: !!user,
        isDoctor: user?.role === 'super_admin',
        isAssistant: user?.role === 'admin',
        isAdmin: user?.role === 'super_admin' || user?.role === 'admin',
        isStudent: user?.role === 'student',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
