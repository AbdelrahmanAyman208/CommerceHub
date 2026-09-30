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
                <th>{t('results.submittedAt')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const examTitle = isAr && r.exam_title_ar ? r.exam_title_ar : r.exam_title;
                const passed = r.passed;

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
