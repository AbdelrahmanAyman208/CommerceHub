import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(identifier, password);
    } catch (err) {
      setError(err.response?.data?.error || t('error'));
    } finally {
      setLoading(false);
    }
  };

  const fillQuickLogin = (id, pass) => {
    setIdentifier(id);
    setPassword(pass);
    setError('');
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div className="logo" style={{ margin: 0 }}>
            <div className="logo-icon">CH</div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>{t('appName')}</h2>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>{t('faculty')}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                const current = localStorage.getItem('ch_theme') || 'dark';
                const next = current === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', next);
                localStorage.setItem('ch_theme', next);
              }}
              className="lang-toggle"
              style={{ fontSize: '12px', padding: '6px 10px' }}
              title="Toggle Light/Dark Theme"
            >
              ☀️/🌙
            </button>
            <button type="button" onClick={toggleLanguage} className="lang-toggle" style={{ fontSize: '12px', padding: '6px 12px' }}>
              {i18n.language === 'ar' ? 'English' : 'العربية'}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '6px', color: '#f8fafc' }}>
            {t('loginTitle')}
          </h1>
          <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
            {t('loginSubtitle')}
          </p>
        </div>

        {error && (
          <div className="status-error" style={{ marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px', fontWeight: 500 }}>
              {t('identifier')}
            </label>
            <input
              type="text"
              className="input-field"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={t('identifierPlaceholder')}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px', fontWeight: 500 }}>
              {t('password')}
            </label>
            <input
              type="password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('passwordPlaceholder')}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', marginTop: '8px', padding: '12px' }}
          >
            {loading ? t('signingIn') : t('login')}
          </button>
        </form>

        {/* Quick Testing Accounts */}
        <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #334155' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontWeight: 700 }}>
            {i18n.language === 'ar' ? 'حسابات تجريبية سريعة' : 'Quick Demo Credentials'}
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => fillQuickLogin('admin@commercehub.edu', 'admin123')}
              className="btn-secondary btn-sm"
            >
              👨‍🏫 {i18n.language === 'ar' ? 'الدكتور (أحمد حسن)' : 'Doctor (Ahmed)'}
            </button>
            <button
              type="button"
              onClick={() => fillQuickLogin('assistant@commercehub.edu', 'admin123')}
              className="btn-secondary btn-sm"
            >
              👩‍🏫 {i18n.language === 'ar' ? 'المعيدة (سارة علي)' : 'Assistant (Sara)'}
            </button>
            <button
              type="button"
              onClick={() => fillQuickLogin('10000001', 'student123')}
              className="btn-secondary btn-sm"
            >
              🎓 {i18n.language === 'ar' ? 'طالب (10000001)' : 'Student (10000001)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
