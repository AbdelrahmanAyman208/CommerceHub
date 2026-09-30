import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/client';

export default function Exams({ onSelectExamForBuilder }) {
  const { t, i18n } = useTranslation();
  const [exams, setExams] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states
  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [duration, setDuration] = useState('60');
  const [totalMarks, setTotalMarks] = useState('20');
  const [maxAttempts, setMaxAttempts] = useState('1'); // Admin selects attempts!
  const [scorePolicy, setScorePolicy] = useState('best');
  const [randomizeQ, setRandomizeQ] = useState(false);
  const [randomizeOpt, setRandomizeOpt] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isAr = i18n.language === 'ar';

  const fetchExams = async () => {
    try {
      const [eRes, cRes] = await Promise.all([api.get('/exams'), api.get('/courses')]);
      setExams(eRes.data.exams || []);
      setCourses(cRes.data.courses || []);
      if (cRes.data.courses?.length > 0 && !courseId) {
        setCourseId(cRes.data.courses[0].id);
      }
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const handleCreateExam = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/exams', {
        course_id: courseId,
        title,
        title_ar: titleAr,
        window_start: new Date(windowStart).toISOString(),
        window_end: new Date(windowEnd).toISOString(),
        duration_minutes: parseInt(duration, 10),
        total_marks: parseFloat(totalMarks),
        max_attempts: parseInt(maxAttempts, 10), // Admin selection
        score_policy: scorePolicy,
        randomize_questions: randomizeQ,
        randomize_options: randomizeOpt,
        published: false,
      });

      setShowCreateModal(false);
      fetchExams();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create exam');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePublish = async (id) => {
    try {
      await api.put(`/exams/${id}/publish`);
      fetchExams();
    } catch (e) {
      alert('Failed to toggle publish status');
    }
  };

  const handleDeleteExam = async (id) => {
    if (!window.confirm(isAr ? 'هل أنت متأكد من حذف هذا الامتحان؟' : 'Are you sure you want to delete this exam?')) return;
    try {
      await api.delete(`/exams/${id}`);
      fetchExams();
    } catch (e) {
      alert('Delete failed');
    }
  };

  const passMarkPreview = (parseFloat(totalMarks) || 0) * 0.5;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>{t('exams.title')}</h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>
            {isAr ? 'إعداد الاختبارات القصيرة، بنوك الأسئلة، وتحديد المحاولات ودرجة النجاح' : 'Setup exams, question banks, attempt limits, and 50% pass mark threshold'}
          </p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          + {t('exams.createExam')}
        </button>
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

            return (
              <div key={exam.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className="course-badge">{courseTitle}</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => handleTogglePublish(exam.id)}
                      className={exam.published ? 'badge-emerald' : 'badge-amber'}
                      style={{ cursor: 'pointer', border: 'none' }}
                      title="Click to toggle publish"
                    >
                      {exam.published ? t('exams.published') : t('exams.draft')}
                    </button>
                    <button
                      onClick={() => handleDeleteExam(exam.id)}
                      className="btn-danger btn-sm"
                      title={t('common.delete')}
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '12px 0 8px 0', color: '#f8fafc' }}>
                  {titleText}
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '12px 0', fontSize: '13px' }}>
                  <div style={{ color: '#94a3b8' }}>
                    ⏱️ {exam.duration_minutes} {isAr ? 'دقيقة' : 'mins'}
                  </div>
                  <div style={{ color: '#94a3b8' }}>
                    🔄 {exam.max_attempts} {isAr ? 'محاولات مسموحة' : 'allowed attempts'}
                  </div>
                  <div style={{ color: '#94a3b8' }}>
                    💯 {exam.total_marks} {isAr ? 'درجة كلية' : 'total marks'}
                  </div>
                  <div style={{ color: '#10b981', fontWeight: 600 }}>
                    🎯 {exam.pass_mark} {isAr ? 'حد النجاح (50%)' : 'pass mark (50%)'}
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
                  📅 {new Date(exam.window_start).toLocaleDateString()} — {new Date(exam.window_end).toLocaleDateString()}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => onSelectExamForBuilder(exam)}
                    className="btn-secondary"
                    style={{ width: '100%', fontSize: '13px' }}
                  >
                    🛠️ {t('questions.builderTitle')} ({exam.question_count || 0})
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Exam Modal */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-card" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📝 {t('exams.createExam')}</h3>
              <button onClick={() => setShowCreateModal(false)} className="modal-close-btn">✕</button>
            </div>

            <form onSubmit={handleCreateExam}>
              <div className="form-group">
                <label>{isAr ? 'المقرر الدراسي' : 'Target Course'}</label>
                <select
                  className="input-field"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  required
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {isAr && c.title_ar ? c.title_ar : c.title}
                    </option>
                  ))}
                </select>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                  <div>
                    <label>{t('exams.examTitle')}</label>
                    <input
                      type="text"
                      className="input-field"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Midterm Exam"
                      required
                    />
                  </div>
                  <div>
                    <label>{t('exams.examTitleAr')}</label>
                    <input
                      type="text"
                      className="input-field"
                      value={titleAr}
                      onChange={(e) => setTitleAr(e.target.value)}
                      placeholder="مثال: امتحان منتصف الفصل"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                  <div>
                    <label>{t('exams.windowStart')}</label>
                    <input
                      type="datetime-local"
                      className="input-field"
                      value={windowStart}
                      onChange={(e) => setWindowStart(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label>{t('exams.windowEnd')}</label>
                    <input
                      type="datetime-local"
                      className="input-field"
                      value={windowEnd}
                      onChange={(e) => setWindowEnd(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '12px' }}>
                  <div>
                    <label>{t('exams.durationMinutes')}</label>
                    <input
                      type="number"
                      className="input-field"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      min="5"
                      required
                    />
                  </div>
                  <div>
                    <label>{t('exams.totalMarks')}</label>
                    <input
                      type="number"
                      className="input-field"
                      value={totalMarks}
                      onChange={(e) => setTotalMarks(e.target.value)}
                      min="1"
                      required
                    />
                  </div>
                  <div>
                    <label>{t('exams.maxAttempts')}</label>
                    <input
                      type="number"
                      className="input-field"
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(e.target.value)}
                      min="1"
                      max="10"
                      required
                    />
                  </div>
                </div>

                {/* 50% Pass Mark Dynamic Indicator */}
                <div style={{ marginTop: '14px', padding: '10px 14px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 600 }}>
                    🎯 {t('exams.passMark')}
                  </span>
                  <span style={{ fontSize: '15px', color: '#10b981', fontWeight: 800 }}>
                    {passMarkPreview} / {totalMarks || 0}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '20px', marginTop: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#cbd5e1', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={randomizeQ}
                      onChange={(e) => setRandomizeQ(e.target.checked)}
                    />
                    {t('exams.randomizeQuestions')}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#cbd5e1', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={randomizeOpt}
                      onChange={(e) => setRandomizeOpt(e.target.checked)}
                    />
                    {t('exams.randomizeOptions')}
                  </label>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '24px' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">
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
