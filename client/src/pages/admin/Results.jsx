import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function Results() {
  const { t, i18n } = useTranslation();
  const { isDoctor, isAssistant } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [investigatingAttempt, setInvestigatingAttempt] = useState(null);
  const [newScore, setNewScore] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isAr = i18n.language === 'ar';

  const fetchResults = async () => {
    try {
      const { data } = await api.get(`/results?search=${encodeURIComponent(search)}`);
      setResults(data.data || []);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [search]);

  const openOverrideModal = (attempt) => {
    if (!isDoctor) return;
    setSelectedAttempt(attempt);
    setNewScore(attempt.score);
    setErrorMsg('');
  };

  const handleOverrideScore = async (e) => {
    e.preventDefault();
    if (!selectedAttempt) return;

    setSubmitting(true);
    setErrorMsg('');
    try {
      await api.put(`/results/${selectedAttempt.attempt_id}/score`, {
        score: parseFloat(newScore),
      });
      setSelectedAttempt(null);
      fetchResults();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to update score');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisqualifyAttempt = async (attempt) => {
    if (
      !window.confirm(
        isAr
          ? 'هل أنت متأكد من تصفير درجة هذا الامتحان وإلغائه بسبب ثبوت محاولات الغش؟'
          : 'Are you sure you want to zero out this exam due to verified cheating violations?'
      )
    ) {
      return;
    }
    try {
      await api.put(`/results/${attempt.attempt_id}/disqualify`);
      setInvestigatingAttempt(null);
      fetchResults();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to disqualify attempt');
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>{t('results.title')}</h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>
            {isAr ? 'كشف درجات الطلاب ونتائج الامتحانات (معيار النجاح 50% كحد أدنى)' : 'Student gradebook and exam submissions (50% pass mark threshold)'}
          </p>
        </div>

        {/* Role permission notice */}
        {isAssistant && (
          <div className="badge-amber" style={{ padding: '8px 14px', fontSize: '12px' }}>
            🔒 {t('results.overrideNotice')}
          </div>
        )}
      </div>

      {/* Filter and Search */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <input
          type="text"
          className="input-field"
          style={{ maxWidth: '380px' }}
          placeholder={isAr ? 'بحث بالاسم، البريد، أو الرقم الجامعي...' : 'Search by name, email, or student ID...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="status-loading">
          <div className="spinner"></div>
        </div>
      ) : results.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <p style={{ color: '#94a3b8' }}>{t('noData')}</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('studentId')}</th>
                <th>{t('results.student')}</th>
                <th>{t('results.exam')}</th>
                <th>{t('results.score')}</th>
                <th>{t('exams.passMark')}</th>
                <th>{t('results.status')}</th>
                <th>{t('results.integrity')}</th>
                <th>{t('results.submittedAt')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const examTitle = isAr && r.exam_title_ar ? r.exam_title_ar : r.exam_title;
                const passed = r.passed;
                const hasViolations = r.violation_count > 0 || r.cheating_flag || (r.violations && r.violations.length > 0);
                const violationTotal = r.violation_count || (r.violations ? r.violations.length : (r.cheating_flag ? 1 : 0));

                return (
                  <tr key={r.attempt_id}>
                    <td>
                      <span className="id-badge">{r.student_number}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>{r.student_name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{r.student_email}</div>
                    </td>
                    <td>
                      <span style={{ color: '#cbd5e1' }}>{examTitle}</span>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        {t('exams.question')} #{r.attempt_number}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '15px', fontWeight: 800, color: passed ? '#10b981' : '#ef4444' }}>
                        {r.score}
                      </span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}> / {r.total_marks}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {r.pass_mark} (50%)
                      </span>
                    </td>
                    <td>
                      <span className={passed ? 'badge-emerald' : 'badge-red'}>
                        {passed ? t('exams.passed') : t('exams.failed')}
                      </span>
                    </td>
                    <td>
                      {hasViolations ? (
                        <button
                          type="button"
                          onClick={() => setInvestigatingAttempt(r)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            border: '1px solid #ef4444',
                            background: 'rgba(239, 68, 68, 0.18)',
                            color: '#fca5a5',
                            fontSize: '11.5px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            boxShadow: '0 0 10px rgba(239, 68, 68, 0.25)',
                          }}
                          title={isAr ? 'اضغط لعرض تفاصيل مخالفات الغش' : 'Click to inspect cheating violation audit'}
                        >
                          <span>🚨</span>
                          <span>{t('results.cheatingFlagged')} ({violationTotal})</span>
                        </button>
                      ) : (
                        <span className="badge-emerald" style={{ fontSize: '11.5px', padding: '4px 8px' }}>
                          🛡️ {t('results.cleanRecord')}
                        </span>
                      )}
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: '12px' }}>
                      {new Date(r.submitted_at).toLocaleString()}
                    </td>
                    <td>
                      {isDoctor ? (
                        <button
                          onClick={() => openOverrideModal(r)}
                          className="btn-secondary btn-sm"
                        >
                          ✏️ {t('results.overrideGrade')}
                        </button>
                      ) : (
                        <span
                          className="badge-blue"
                          style={{ fontSize: '11px', opacity: 0.7, cursor: 'not-allowed' }}
                          title={t('results.assistantRestricted')}
                        >
                          🔒 {isAr ? 'للدكتور فقط' : 'Doctor Only'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Cheating Investigation Audit Modal */}
      {investigatingAttempt && (
        <div className="modal-backdrop" onClick={() => setInvestigatingAttempt(null)}>
          <div
            className="modal-card"
            style={{
              maxWidth: '560px',
              border: '1px solid rgba(239, 68, 68, 0.45)',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7), 0 0 25px rgba(239, 68, 68, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '24px' }}>🚨</span>
                <h3 style={{ margin: 0, color: '#f87171' }}>{t('results.auditTitle')}</h3>
              </div>
              <button onClick={() => setInvestigatingAttempt(null)} className="modal-close-btn">
                ✕
              </button>
            </div>

            {/* Student metadata */}
            <div
              style={{
                padding: '12px 16px',
                background: 'rgba(30, 41, 59, 0.7)',
                borderRadius: '10px',
                margin: '14px 0',
                fontSize: '13px',
                border: '1px solid var(--color-border, #334155)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <strong style={{ color: '#f8fafc', fontSize: '15px' }}>{investigatingAttempt.student_name}</strong>
                <span className="id-badge">{investigatingAttempt.student_number}</span>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                {investigatingAttempt.student_email}
              </div>
              <div style={{ color: '#cbd5e1', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                <span>{isAr && investigatingAttempt.exam_title_ar ? investigatingAttempt.exam_title_ar : investigatingAttempt.exam_title}</span>
                <strong style={{ color: investigatingAttempt.passed ? '#10b981' : '#ef4444' }}>
                  {t('results.score')}: {investigatingAttempt.score} / {investigatingAttempt.total_marks}
                </strong>
              </div>
            </div>

            <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#94a3b8', margin: '14px 0 8px 0', letterSpacing: '0.05em' }}>
              ⏱️ {t('results.auditTimeline')}
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
              {investigatingAttempt.violations && investigatingAttempt.violations.length > 0 ? (
                investigatingAttempt.violations.map((v, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(239, 68, 68, 0.09)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '12.5px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>{v.type === 'screenshot' ? '📸' : '🔀'}</span>
                      <span style={{ fontWeight: 600, color: '#fca5a5' }}>{v.label}</span>
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: '11px', whiteSpace: 'nowrap' }}>{v.timestamp}</span>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    padding: '12px 14px',
                    background: 'rgba(239, 68, 68, 0.09)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: '8px',
                    color: '#fca5a5',
                    fontSize: '13px',
                  }}
                >
                  ⚠️ {t('antiScreenshot.warningMessage')}
                </div>
              )}
            </div>

            {/* Modal actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '22px', alignItems: 'center' }}>
              {isDoctor && (
                <button
                  type="button"
                  onClick={() => handleDisqualifyAttempt(investigatingAttempt)}
                  className="btn-danger"
                  style={{ padding: '10px 18px', fontSize: '13px', fontWeight: 700 }}
                >
                  🚫 {t('results.disqualify')}
                </button>
              )}
              <button
                type="button"
                onClick={() => setInvestigatingAttempt(null)}
                className="btn-secondary"
                style={{ padding: '10px 18px', fontSize: '13px' }}
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Doctor Grade Adjustment Modal */}
      {selectedAttempt && isDoctor && (
        <div className="modal-backdrop" onClick={() => setSelectedAttempt(null)}>
          <div className="modal-card" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>👨‍🏫 {t('results.overrideGrade')}</h3>
              <button onClick={() => setSelectedAttempt(null)} className="modal-close-btn">✕</button>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '14px' }}>
              {isAr ? 'تعديل درجة الطالب الرسمية:' : 'Adjust student official score:'}{' '}
              <strong style={{ color: '#f8fafc' }}>{selectedAttempt.student_name}</strong> ({selectedAttempt.student_number})
            </p>

            {errorMsg && <div className="status-error" style={{ marginBottom: '14px' }}>{errorMsg}</div>}

            <form onSubmit={handleOverrideScore}>
              <div className="form-group">
                <label>
                  {t('results.newScore')} (Max: {selectedAttempt.total_marks})
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max={selectedAttempt.total_marks}
                  className="input-field"
                  value={newScore}
                  onChange={(e) => setNewScore(e.target.value)}
                  required
                />

                <div style={{ marginTop: '12px', fontSize: '12px', color: '#64748b' }}>
                  {isAr ? 'الدرجة السابقة:' : 'Previous score:'} {selectedAttempt.score} / {selectedAttempt.total_marks}
                  {' · '}
                  {isAr ? 'حد النجاح (50%):' : 'Pass threshold (50%):'} {selectedAttempt.pass_mark}
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button type="button" onClick={() => setSelectedAttempt(null)} className="btn-secondary">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? t('loading') : t('results.updateScore')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
