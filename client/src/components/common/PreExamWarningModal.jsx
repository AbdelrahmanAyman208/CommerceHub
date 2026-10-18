import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function PreExamWarningModal({
  isOpen,
  exam,
  onAccept,
  onCancel,
}) {
  const { t, i18n } = useTranslation();
  const [pledged, setPledged] = useState(false);
  const isAr = i18n.language === 'ar';

  if (!isOpen || !exam) return null;

  const examTitle = isAr && exam.title_ar ? exam.title_ar : exam.title;
  const courseTitle = isAr && exam.course_title_ar ? exam.course_title_ar : exam.course_title;

  return (
    <div
      className="modal-backdrop"
      style={{
        zIndex: 10000,
        background: 'rgba(10, 12, 18, 0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="modal-card"
        style={{
          maxWidth: '680px',
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(239, 68, 68, 0.15)',
          borderRadius: '16px',
          padding: '28px',
          background: 'var(--color-bg-elevated, #111827)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Badge */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '999px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              marginBottom: '12px',
            }}
          >
            🚨 {t('examWarning.badge')}
          </div>

          <h2
            style={{
              fontSize: '22px',
              fontWeight: 800,
              color: '#f8fafc',
              margin: '0 0 8px 0',
              lineHeight: 1.3,
            }}
          >
            {t('examWarning.title')}
          </h2>

          <p
            style={{
              color: '#94a3b8',
              fontSize: '14px',
              margin: 0,
              maxWidth: '560px',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            {t('examWarning.subtitle')}
          </p>
        </div>

        {/* Exam Information Capsule */}
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.7)',
            border: '1px solid var(--color-border, #334155)',
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '12px',
            fontSize: '13px',
          }}
        >
          <div>
            <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
              {isAr ? 'المقرر' : 'Course'}
            </div>
            <div style={{ color: '#f8fafc', fontWeight: 700, marginTop: '2px' }}>
              {courseTitle || 'Commerce Hub'}
            </div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
              {isAr ? 'الامتحان' : 'Exam'}
            </div>
            <div style={{ color: '#f8fafc', fontWeight: 700, marginTop: '2px' }}>
              {examTitle}
            </div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
              {isAr ? 'المدة' : 'Duration'}
            </div>
            <div style={{ color: '#f8fafc', fontWeight: 700, marginTop: '2px' }}>
              ⏱️ {exam.duration_minutes || exam.durationMinutes || 30} {isAr ? 'دقيقة' : 'mins'}
            </div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
              {t('exams.passMark')}
            </div>
            <div style={{ color: '#10b981', fontWeight: 800, marginTop: '2px' }}>
              🎯 {exam.pass_mark || exam.passMark || (parseFloat(exam.total_marks || exam.totalMarks || 10) * 0.5)} (50%)
            </div>
          </div>
        </div>

        {/* 4 Strict Academic Integrity Rules */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '22px' }}>
          {/* Rule 1: Window / Tab Switch */}
          <div
            style={{
              display: 'flex',
              gap: '14px',
              padding: '12px 14px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '10px',
            }}
          >
            <div style={{ fontSize: '24px', flexShrink: 0 }}>🔀</div>
            <div>
              <div style={{ fontWeight: 700, color: '#fca5a5', fontSize: '14px', marginBottom: '3px' }}>
                {t('examWarning.rule1Title')}
              </div>
              <div style={{ color: '#cbd5e1', fontSize: '12.5px', lineHeight: 1.5 }}>
                {t('examWarning.rule1Desc')}
              </div>
            </div>
          </div>

          {/* Rule 2: Snipping Tool & Screenshots */}
          <div
            style={{
              display: 'flex',
              gap: '14px',
              padding: '12px 14px',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: '10px',
            }}
          >
            <div style={{ fontSize: '24px', flexShrink: 0 }}>📸</div>
            <div>
              <div style={{ fontWeight: 700, color: '#fcd34d', fontSize: '14px', marginBottom: '3px' }}>
                {t('examWarning.rule2Title')}
              </div>
              <div style={{ color: '#cbd5e1', fontSize: '12.5px', lineHeight: 1.5 }}>
                {t('examWarning.rule2Desc')}
              </div>
            </div>
          </div>

          {/* Rule 3: Watermark */}
          <div
            style={{
              display: 'flex',
              gap: '14px',
              padding: '12px 14px',
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: '10px',
            }}
          >
            <div style={{ fontSize: '24px', flexShrink: 0 }}>🛡️</div>
            <div>
              <div style={{ fontWeight: 700, color: '#a5b4fc', fontSize: '14px', marginBottom: '3px' }}>
                {t('examWarning.rule3Title')}
              </div>
              <div style={{ color: '#cbd5e1', fontSize: '12.5px', lineHeight: 1.5 }}>
                {t('examWarning.rule3Desc')}
              </div>
            </div>
          </div>

          {/* Rule 4: Professor Referral */}
          <div
            style={{
              display: 'flex',
              gap: '14px',
              padding: '12px 14px',
              background: 'rgba(168, 85, 247, 0.08)',
              border: '1px solid rgba(168, 85, 247, 0.25)',
              borderRadius: '10px',
            }}
          >
            <div style={{ fontSize: '24px', flexShrink: 0 }}>⚖️</div>
            <div>
              <div style={{ fontWeight: 700, color: '#d8b4fe', fontSize: '14px', marginBottom: '3px' }}>
                {t('examWarning.rule4Title')}
              </div>
              <div style={{ color: '#cbd5e1', fontSize: '12.5px', lineHeight: 1.5 }}>
                {t('examWarning.rule4Desc')}
              </div>
            </div>
          </div>
        </div>

        {/* Mandatory Pledge Checkbox */}
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '14px',
            background: pledged ? 'rgba(16, 185, 129, 0.1)' : 'rgba(15, 23, 42, 0.6)',
            border: pledged ? '1px solid #10b981' : '1px solid #475569',
            borderRadius: '10px',
            cursor: 'pointer',
            marginBottom: '24px',
            transition: 'all 0.2s ease',
          }}
        >
          <input
            type="checkbox"
            checked={pledged}
            onChange={(e) => setPledged(e.target.checked)}
            style={{
              width: '20px',
              height: '20px',
              accentColor: '#10b981',
              cursor: 'pointer',
              marginTop: '2px',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: '13px', lineHeight: 1.6, color: pledged ? '#f8fafc' : '#cbd5e1', fontWeight: 600 }}>
            {t('examWarning.pledgeText')}
          </span>
        </label>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary"
            style={{ padding: '12px 20px', borderRadius: '8px', fontSize: '14px' }}
          >
            {t('examWarning.cancelBtn')}
          </button>
          <button
            type="button"
            disabled={!pledged}
            onClick={onAccept}
            className="btn-primary"
            style={{
              padding: '12px 28px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 700,
              background: pledged ? 'linear-gradient(135deg, #10b981, #059669)' : '#475569',
              opacity: pledged ? 1 : 0.6,
              cursor: pledged ? 'pointer' : 'not-allowed',
              boxShadow: pledged ? '0 4px 15px rgba(16, 185, 129, 0.4)' : 'none',
            }}
          >
            🚀 {t('examWarning.startBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}
