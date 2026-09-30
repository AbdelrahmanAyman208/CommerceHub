import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/client';

export default function MyGrades() {
  const { t, i18n } = useTranslation();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  const isAr = i18n.language === 'ar';

  useEffect(() => {
    const fetchGrades = async () => {
      try {
        const { data } = await api.get('/results/my');
        setResults(data.results || []);
      } catch (e) {
      } finally {
        setLoading(false);
      }
    };
    fetchGrades();
  }, []);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>🏆 {t('nav.myGrades')}</h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>
            {isAr
              ? 'كشف الدرجات والنتائج الرسمية للامتحانات المكتملة (حد النجاح 50%)'
              : 'Official transcripts and exam performance (50% pass mark threshold)'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="status-loading">
          <div className="spinner"></div>
        </div>
      ) : results.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <p style={{ color: '#94a3b8' }}>
            {isAr ? 'لم تسجل أي نتائج امتحانات بعد.' : 'No exam results recorded yet.'}
          </p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('courses.title')}</th>
                <th>{t('results.exam')}</th>
                <th>{isAr ? 'رقم المحاولة' : 'Attempt'}</th>
                <th>{t('results.score')}</th>
                <th>{t('exams.passMark')}</th>
                <th>{t('results.status')}</th>
                <th>{t('results.submittedAt')}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const examTitle = isAr && r.exam_title_ar ? r.exam_title_ar : r.title;
                const courseTitle = isAr && r.course_title_ar ? r.course_title_ar : r.course_title;
                const passed = r.passed;

                return (
                  <tr key={r.attempt_id}>
                    <td>
                      <span className="course-badge">{courseTitle}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>{examTitle}</div>
                    </td>
                    <td>
                      <span className="id-badge">#{r.attempt_number}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '16px', fontWeight: 800, color: passed ? '#10b981' : '#ef4444' }}>
                        {r.score}
                      </span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}> / {r.total_marks}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '13px', color: '#94a3b8' }}>
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
