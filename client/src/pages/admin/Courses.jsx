import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/client';

export default function Courses() {
  const { t, i18n } = useTranslation();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  // Form states
  const [title, setTitle] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [desc, setDesc] = useState('');
  const [descAr, setDescAr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isAr = i18n.language === 'ar';

  const fetchCourses = async () => {
    try {
      const { data } = await api.get('/courses');
      setCourses(data.courses || []);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/courses', {
        title,
        title_ar: titleAr,
        description: desc,
        description_ar: descAr,
      });
      setShowAddModal(false);
      setTitle('');
      setTitleAr('');
      setDesc('');
      setDescAr('');
      fetchCourses();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create course');
    } finally {
      setSubmitting(false);
    }
  };

  const openEnrollModal = async (course) => {
    setSelectedCourse(course);
    setSelectedStudentIds([]);
    setShowEnrollModal(true);
    try {
      const { data } = await api.get('/admin/students?limit=100');
      setStudents(data.data || []);
    } catch (e) {}
  };

  const handleEnroll = async (e) => {
    e.preventDefault();
    if (selectedStudentIds.length === 0) return;
    setSubmitting(true);
    try {
      await api.post(`/courses/${selectedCourse.id}/enroll`, {
        student_ids: selectedStudentIds,
      });
      setShowEnrollModal(false);
      fetchCourses();
    } catch (err) {
      alert(err.response?.data?.error || 'Enrollment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCourse = async (id) => {
    if (!window.confirm(isAr ? 'هل أنت متأكد من حذف هذا المقرر؟' : 'Are you sure you want to delete this course?')) return;
    try {
      await api.delete(`/courses/${id}`);
      fetchCourses();
    } catch (err) {
      alert('Delete failed');
    }
  };

  const toggleStudentSelection = (id) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>{t('courses.title')}</h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>
            {isAr ? 'إدارة المقررات الدراسية بكلية التجارة والطلاب المسجلين' : 'Manage faculty courses and student enrollments'}
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary">
          + {t('courses.addCourse')}
        </button>
      </div>

      {loading ? (
        <div className="status-loading">
          <div className="spinner"></div>
        </div>
      ) : courses.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <p style={{ color: '#94a3b8' }}>{t('courses.noCourses')}</p>
        </div>
      ) : (
        <div className="cards-grid">
          {courses.map((c) => {
            const courseTitle = isAr && c.title_ar ? c.title_ar : c.title;
            const courseDesc = isAr && c.description_ar ? c.description_ar : c.description;

            return (
              <div key={c.id} className="card course-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="course-badge">CH-{c.id.substring(0, 4).toUpperCase()}</div>
                  <button
                    onClick={() => handleDeleteCourse(c.id)}
                    className="btn-danger btn-sm"
                    title={t('common.delete')}
                  >
                    🗑️
                  </button>
                </div>

                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '12px 0 6px 0', color: '#f8fafc' }}>
                  {courseTitle}
                </h3>
                <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5, minHeight: '40px' }}>
                  {courseDesc || (isAr ? 'لا يوجد وصف للمقرر' : 'No description provided')}
                </p>

                <div className="course-metrics">
                  <div className="metric">
                    <span className="metric-num">{c.enrolled_students_count || 0}</span>
                    <span className="metric-label">{t('courses.enrolledStudents')}</span>
                  </div>
                  <div className="metric">
                    <span className="metric-num">{c.lectures_count || 0}</span>
                    <span className="metric-label">{t('courses.lecturesCount')}</span>
                  </div>
                  <div className="metric">
                    <span className="metric-num">{c.exams_count || 0}</span>
                    <span className="metric-label">{t('courses.examsCount')}</span>
                  </div>
                </div>

                <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => openEnrollModal(c)}
                    className="btn-secondary"
                    style={{ width: '100%', fontSize: '13px' }}
                  >
                    👥 {t('courses.enrollStudents')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Course Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('courses.addCourse')}</h3>
              <button onClick={() => setShowAddModal(false)} className="modal-close-btn">✕</button>
            </div>
            <form onSubmit={handleCreateCourse}>
              <div className="form-group">
                <label>{t('courses.courseTitle')}</label>
                <input
                  type="text"
                  className="input-field"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Cost Accounting"
                  required
                />

                <label style={{ marginTop: '12px' }}>{t('courses.courseTitleAr')}</label>
                <input
                  type="text"
                  className="input-field"
                  value={titleAr}
                  onChange={(e) => setTitleAr(e.target.value)}
                  placeholder="مثال: محاسبة التكاليف"
                />

                <label style={{ marginTop: '12px' }}>{t('courses.description')}</label>
                <textarea
                  className="input-field"
                  rows="2"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                ></textarea>

                <label style={{ marginTop: '12px' }}>{t('courses.descriptionAr')}</label>
                <textarea
                  className="input-field"
                  rows="2"
                  value={descAr}
                  onChange={(e) => setDescAr(e.target.value)}
                ></textarea>
              </div>

              <div className="modal-actions">
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

      {/* Enroll Students Modal */}
      {showEnrollModal && (
        <div className="modal-backdrop" onClick={() => setShowEnrollModal(false)}>
          <div className="modal-card" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>👥 {t('courses.enrollStudents')} — {selectedCourse?.title}</h3>
              <button onClick={() => setShowEnrollModal(false)} className="modal-close-btn">✕</button>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '14px' }}>
              {isAr ? 'اختر الطلاب من القائمة لإضافتهم إلى هذا المقرر:' : 'Select students from the roster to enroll in this course:'}
            </p>

            <form onSubmit={handleEnroll}>
              <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid #334155', borderRadius: '8px', padding: '8px' }}>
                {students.map((s) => (
                  <label
                    key={s.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: selectedStudentIds.includes(s.id) ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.includes(s.id)}
                      onChange={() => toggleStudentSelection(s.id)}
                    />
                    <div>
                      <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '14px' }}>{s.name}</span>
                      <span className="id-badge" style={{ marginInlineStart: '8px' }}>{s.student_id}</span>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{s.email}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="modal-actions" style={{ marginTop: '16px' }}>
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                  {selectedStudentIds.length} {isAr ? 'طالب محدد' : 'selected'}
                </span>
                <button type="submit" disabled={submitting || selectedStudentIds.length === 0} className="btn-primary">
                  {submitting ? t('loading') : t('courses.enrollStudents')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
