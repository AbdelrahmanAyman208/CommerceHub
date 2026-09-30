import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/client';

export default function MyExams({ onStartExam }) {
  const { t, i18n } = useTranslation();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  const isAr = i18n.language === 'ar';

  const fetchExams = async () => {
    try {
      const { data } = await api.get('/exams');
      setExams(data.exams || []);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>📝 {t('nav.myExams')}</h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>
            {isAr
              ? 'الاختبارات المتاحة والمجدولة لمقرراتك الدراسية (معيار النجاح 50%)'
              : 'Available and scheduled exams for your courses (50% pass mark criteria)'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="status-loading">
          <div className="spinner"></div>
        </div>
      ) : exams.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <p style={{ color: '#94a3b8' }}>{t('exams.noExams')}</p>
        </div>
      ) : (
        <div className="cards-grid">
          {exams.map((exam) => {
            const titleText = isAr && exam.title_ar ? exam.title_ar : exam.title;
            const courseTitle = isAr && exam.course_title_ar ? exam.course_title_ar : exam.course_title;

            const attemptsUsed = exam.my_attempts_count || 0;
            const maxAttempts = exam.max_attempts || 1;
            const hasAttemptsLeft = attemptsUsed < maxAttempts;
            const isActive = exam.window_status === 'active';
            const isUpcoming = exam.window_status === 'upcoming';
            const isClosed = exam.window_status === 'closed';

            return (
              <div key={exam.id} className="card exam-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className="course-badge">{courseTitle}</span>
                  <span
                    className={
                      exam.has_active_attempt
                        ? 'badge-amber'
                        : isActive
                        ? 'badge-emerald'
                        : isUpcoming
                        ? 'badge-blue'
                        : 'badge-red'
                    }
                  >
                    {exam.has_active_attempt
                      ? (isAr ? 'محاولة جارية' : 'In Progress')
                      : isActive
                      ? (isAr ? 'متاح الآن' : 'Available')
                      : isUpcoming
                      ? (isAr ? 'قادم قريباً' : 'Upcoming')
                      : (isAr ? 'انتهت الفترة' : 'Closed')}
                  </span>
                </div>

                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '14px 0 8px 0', color: '#f8fafc' }}>
                  {titleText}
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '12px 0', fontSize: '13px' }}>
                  <div style={{ color: '#94a3b8' }}>
                    ⏱️ {exam.duration_minutes} {isAr ? 'دقيقة' : 'mins'}
                  </div>
                  <div style={{ color: '#94a3b8' }}>
                    🔄 {isAr ? 'المحاولات:' : 'Attempts:'} {attemptsUsed} / {maxAttempts}
                  </div>
                  <div style={{ color: '#94a3b8' }}>
                    💯 {t('exams.totalMarks')}: {exam.total_marks}
                  </div>
                  <div style={{ color: '#10b981', fontWeight: 600 }}>
                    🎯 {t('exams.passMark')}: {exam.pass_mark}
                  </div>
                </div>

                {exam.my_best_score !== null && (
                  <div style={{ padding: '8px 12px', background: 'rgba(30, 41, 59, 0.6)', borderRadius: '6px', marginBottom: '14px', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>{t('exams.bestScore')}:</span>
                    <strong style={{ color: exam.my_best_score >= exam.pass_mark ? '#10b981' : '#ef4444' }}>
                      {exam.my_best_score} / {exam.total_marks} ({exam.my_best_score >= exam.pass_mark ? t('exams.passed') : t('exams.failed')})
                    </strong>
                  </div>
                )}

                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
                  📅 {new Date(exam.window_start).toLocaleDateString()} — {new Date(exam.window_end).toLocaleDateString()}
                </div>

                {exam.has_active_attempt ? (
                  <button
                    onClick={() => onStartExam(exam.id)}
                    className="btn-primary"
                    style={{ width: '100%', background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                  >
                    ⚡ {t('exams.resumeExam')}
                  </button>
                ) : isActive && hasAttemptsLeft ? (
                  <button
                    onClick={() => onStartExam(exam.id)}
                    className="btn-primary"
                    style={{ width: '100%' }}
                  >
                    🚀 {t('exams.startExam')} ({isAr ? `المحاولة ${attemptsUsed + 1}` : `Attempt ${attemptsUsed + 1}`})
                  </button>
                ) : (
                  <button
                    disabled
                    className="btn-secondary"
                    style={{ width: '100%', opacity: 0.6, cursor: 'not-allowed' }}
                  >
                    {!hasAttemptsLeft
                      ? (isAr ? 'استنفدت جميع المحاولات' : 'Max attempts reached')
                      : isUpcoming
                      ? (isAr ? 'لم تبدأ فترة الامتحان بعد' : 'Not open yet')
                      : (isAr ? 'انتهى موعد الامتحان' : 'Exam closed')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
