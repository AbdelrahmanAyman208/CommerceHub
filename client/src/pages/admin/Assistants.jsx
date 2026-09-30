import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function Assistants() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isAr = i18n.language === 'ar';

  const fetchAdmins = async () => {
    try {
      const { data } = await api.get('/admin/admins');
      setAdmins(data.admins || []);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleAddAssistant = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/admin/admins', {
        name,
        email,
        password,
        role: 'admin', // Assistant
      });
      setShowAddModal(false);
      setName('');
      setEmail('');
      setPassword('');
      fetchAdmins();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add assistant');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAdmin = async (id) => {
    if (!window.confirm(isAr ? 'هل أنت متأكد من حذف هذا الحساب؟' : 'Are you sure you want to remove this assistant?')) return;
    try {
      await api.delete(`/admin/admins/${id}`);
      fetchAdmins();
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed');
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>{t('assistants.title')}</h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>
            {isAr
              ? 'إدارة المعيدين والمساعدين الأكاديميين وصلاحياتهم الإدارية'
              : 'Manage teaching assistants and academic support staff'}
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary">
          + {t('assistants.addAssistant')}
        </button>
      </div>

      {/* Permission boundary reminder */}
      <div className="card" style={{ marginBottom: '24px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>ℹ️</span>
          <span style={{ fontSize: '13px', color: '#cbd5e1' }}>
            {t('assistants.assistantRoleNotice')}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="status-loading">
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('students.name')}</th>
                <th>{t('students.email')}</th>
                <th>{t('role')}</th>
                <th>{isAr ? 'تعديل الدرجات' : 'Grade Editing'}</th>
                <th>{isAr ? 'تاريخ الإنشاء' : 'Created At'}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((adm) => {
                const isSuper = adm.role === 'super_admin';
                return (
                  <tr key={adm.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>{adm.name}</div>
                    </td>
                    <td style={{ color: '#94a3b8' }}>{adm.email}</td>
                    <td>
                      <span className={isSuper ? 'badge-purple' : 'badge-blue'}>
                        {isSuper ? t('super_admin') : t('admin')}
                      </span>
                    </td>
                    <td>
                      {isSuper ? (
                        <span style={{ color: '#10b981', fontSize: '13px', fontWeight: 600 }}>
                          ✓ {isAr ? 'مسموح (الدكتور)' : 'Allowed (Doctor)'}
                        </span>
                      ) : (
                        <span style={{ color: '#ef4444', fontSize: '13px' }}>
                          ✕ {isAr ? 'محظور (للدكتور فقط)' : 'Restricted (Doctor Only)'}
                        </span>
                      )}
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: '12px' }}>
                      {new Date(adm.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      {adm.id !== user.id && !isSuper && (
                        <button
                          onClick={() => handleDeleteAdmin(adm.id)}
                          className="btn-danger btn-sm"
                        >
                          🗑️
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Assistant Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>👩‍🏫 {t('assistants.addAssistant')}</h3>
              <button onClick={() => setShowAddModal(false)} className="modal-close-btn">✕</button>
            </div>

            <form onSubmit={handleAddAssistant}>
              <div className="form-group">
                <label>{t('students.name')}</label>
                <input
                  type="text"
                  className="input-field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sara Ali"
                  required
                />

                <label style={{ marginTop: '12px' }}>{t('students.email')}</label>
                <input
                  type="email"
                  className="input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="assistant@commercehub.edu"
                  required
                />

                <label style={{ marginTop: '12px' }}>{t('password')}</label>
                <input
                  type="password"
                  className="input-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? t('loading') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
