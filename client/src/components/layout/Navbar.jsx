import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';

export default function Navbar({ onOpenNotifications }) {
  const { t, i18n } = useTranslation();
  const { user, logout, isDoctor, isAssistant, isStudent } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [theme, setTheme] = useState(localStorage.getItem('ch_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ch_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const fetchUnread = async () => {
    try {
      const { data } = await api.get('/notifications');
      setUnreadCount(data.unreadCount || 0);
    } catch (e) {}
  };

  useEffect(() => {
    if (user) {
      fetchUnread();
      const interval = setInterval(fetchUnread, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
  };

  const getRoleBadge = () => {
    if (isDoctor) return { label: t('super_admin'), color: 'badge-purple' };
    if (isAssistant) return { label: t('admin'), color: 'badge-blue' };
    return { label: `${t('student')} #${user?.studentId || ''}`, color: 'badge-emerald' };
  };

  const roleBadge = getRoleBadge();

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <div className="brand-logo">
          <span>CH</span>
        </div>
        <div className="brand-text">
          <span className="brand-name">{t('appName')}</span>
          <span className="brand-sub">{t('faculty')}</span>
        </div>
      </div>

      <div className="navbar-actions">
        {/* Theme Toggle */}
        <button onClick={toggleTheme} className="nav-btn theme-btn" title="Toggle Light/Dark Theme">
          {theme === 'dark' ? '☀️ ' + (i18n.language === 'ar' ? 'المظهر الفاتح' : 'Light') : '🌙 ' + (i18n.language === 'ar' ? 'المظهر الداكن' : 'Dark')}
        </button>

        {/* Language switch */}
        <button onClick={toggleLanguage} className="nav-btn lang-btn" title="Toggle Language">
          🌐 {i18n.language === 'ar' ? 'English' : 'العربية'}
        </button>

        {/* Notifications button */}
        <button
          onClick={onOpenNotifications}
          className="nav-btn notification-btn"
          title={t('nav.notifications')}
        >
          🔔
          {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
        </button>

        {/* User profile capsule */}
        {user && (
          <div className="user-capsule">
            <div className="user-avatar">{user.name.charAt(0)}</div>
            <div className="user-details">
              <span className="user-name">{user.name}</span>
              <span className={`role-pill ${roleBadge.color}`}>{roleBadge.label}</span>
            </div>
            <button onClick={logout} className="logout-btn" title={t('logout')}>
              🚪
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
