import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/client';

export default function NotificationsModal({ isOpen, onClose }) {
  const { t, i18n } = useTranslation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications || []);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (e) {}
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (e) {}
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🔔 {t('nav.notifications')}</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={markAllAsRead} className="btn-secondary btn-sm">
              ✓ {i18n.language === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all read'}
            </button>
            <button onClick={onClose} className="modal-close-btn">
              ✕
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ maxHeight: '420px', overflowY: 'auto' }}>
          {loading ? (
            <div className="status-loading">
              <div className="spinner"></div>
            </div>
          ) : notifications.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: '32px 0' }}>
              {i18n.language === 'ar' ? 'لا توجد إشعارات حالياً' : 'No notifications'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {notifications.map((n) => {
                const title = i18n.language === 'ar' && n.title_ar ? n.title_ar : n.title;
                const body = i18n.language === 'ar' && n.body_ar ? n.body_ar : n.body;
                return (
                  <div
                    key={n.id}
                    onClick={() => markAsRead(n.id)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      background: n.read ? 'rgba(30, 41, 59, 0.4)' : 'rgba(59, 130, 246, 0.12)',
                      border: n.read ? '1px solid #334155' : '1px solid rgba(59, 130, 246, 0.3)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '14px', color: n.read ? '#cbd5e1' : '#60a5fa' }}>
                        {title}
                      </strong>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
                      {body}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
