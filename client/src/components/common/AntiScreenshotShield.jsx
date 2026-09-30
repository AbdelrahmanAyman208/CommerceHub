import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAntiScreenshot } from '../../hooks/useAntiScreenshot';
import { useAuth } from '../../context/AuthContext';

export default function AntiScreenshotShield({ children, enabled = true }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { blurred } = useAntiScreenshot(enabled);

  const watermarkText = user
    ? `CommerceHub · ${user.name} (${user.studentId || user.email})`
    : 'CommerceHub Academic Shield';

  return (
    <div
      className="anti-screenshot-wrapper"
      style={{
        position: 'relative',
        userSelect: enabled ? 'none' : 'auto',
        WebkitUserSelect: enabled ? 'none' : 'auto',
      }}
    >
      {/* Dynamic Watermark Stamp for photo camera deterrence */}
      {enabled && (
        <div
          className="watermark-overlay"
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 10,
            opacity: 0.05,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '80px',
            alignContent: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            fontSize: '14px',
            fontWeight: 700,
            transform: 'rotate(-15deg)',
          }}
        >
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} style={{ whiteSpace: 'nowrap' }}>
              {watermarkText}
            </span>
          ))}
        </div>
      )}

      {/* Sensitive Content container (blurred if user unfocuses) */}
      <div
        className="protected-content"
        style={{
          filter: blurred ? 'blur(25px)' : 'none',
          transition: 'filter 0.2s ease-in-out',
        }}
      >
        {children}
      </div>

      {/* Full screen blur alert overlay when tab/window is switched */}
      {blurred && enabled && (
        <div
          className="blur-warning-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 999,
            backdropFilter: 'blur(20px)',
            background: 'rgba(15, 23, 42, 0.85)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
            borderRadius: '12px',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛡️</div>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
            {t('antiScreenshot.warningTitle')}
          </h3>
          <p style={{ maxWidth: '420px', color: '#94a3b8', fontSize: '14px', lineHeight: 1.6 }}>
            {t('antiScreenshot.warningMessage')}
          </p>
        </div>
      )}
    </div>
  );
}
