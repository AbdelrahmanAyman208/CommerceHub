import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

export default function ChangePasswordModal({ isOpen }) {
  const { t } = useTranslation();
  const { updatePassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(newPassword);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <h3>🔒 {t('changePasswordTitle')}</h3>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>
          {t('changePasswordSubtitle')}
        </p>

        {error && <div className="status-error" style={{ marginBottom: '16px' }}>{error}</div>}

        <form onSubmit={handleSubmit} className="form-group">
          <label>{t('newPassword')}</label>
          <input
            type="password"
            className="input-field"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            placeholder="••••••••"
          />

          <label style={{ marginTop: '14px' }}>{t('confirmPassword')}</label>
          <input
            type="password"
            className="input-field"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="••••••••"
          />

          <div className="modal-actions" style={{ marginTop: '24px' }}>
            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%' }}>
              {loading ? t('loading') : t('updatePassword')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
