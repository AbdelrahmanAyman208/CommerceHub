import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAntiScreenshot } from '../../hooks/useAntiScreenshot';
import { useAuth } from '../../context/AuthContext';

export default function AntiScreenshotShield({ children, enabled = true }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { blurred, resume } = useAntiScreenshot(enabled);

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
            zIndex: 15,
            opacity: 0.18,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '64px',
            alignContent: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            fontSize: '15px',
            fontWeight: 800,
            letterSpacing: '0.04em',
            transform: 'rotate(-18deg) scale(1.1)',
            color: 'var(--color-primary-light, #6366f1)',
          }}
        >
          {Array.from({ length: 64 }).map((_, i) => (
            <span key={i} style={{ whiteSpace: 'nowrap', textShadow: '0 0 1px rgba(0,0,0,0.2)' }}>
              {watermarkText}
            </span>
          ))}
        </div>
      )}

      {/* Sensitive Content container (instant 0ms blur/blackout if user unfocuses) */}
      <div
        className="protected-content"
        style={{
          filter: blurred ? 'blur(35px)' : 'none',
          opacity: blurred ? 0.02 : 1,
          transition: blurred ? 'none' : 'filter 0.15s ease-out, opacity 0.15s ease-out',
          pointerEvents: blurred ? 'none' : 'auto',
        }}
      >
        {children}
      </div>

      {/* Full screen blur alert overlay when tab/window is switched */}
      {blurred && enabled && (
        <div
          className="blur-warning-overlay"
          onClick={resume}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 9999,
            backdropFilter: 'blur(30px)',
            background: 'rgba(15, 23, 42, 0.98)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
            borderRadius: '12px',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: '52px', marginBottom: '16px', filter: 'drop-shadow(0 0 15px rgba(99,102,241,0.5))' }}>🛡️</div>
          <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc', marginBottom: '8px' }}>
            {t('antiScreenshot.warningTitle')}
          </h3>
          <p style={{ maxWidth: '440px', color: '#cbd5e1', fontSize: '14px', lineHeight: 1.6, marginBottom: '22px' }}>
            {t('antiScreenshot.warningMessage')}
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              resume();
            }}
            className="btn-primary"
            style={{ padding: '12px 28px', fontSize: '15px', fontWeight: 700, borderRadius: '10px' }}
          >
            {i18n.language === 'ar' ? 'متابعة الامتحان' : 'Resume Exam'}
          </button>
        </div>
      )}
    </div>
  );
}
