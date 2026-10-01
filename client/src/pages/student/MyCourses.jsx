import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/client';
import AntiScreenshotShield from '../../components/common/AntiScreenshotShield';

export default function MyCourses() {
  const { t, i18n } = useTranslation();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [lectures, setLectures] = useState([]);
  const [lecturesLoading, setLecturesLoading] = useState(false);
  const [activePdfUrl, setActivePdfUrl] = useState(null);

  const isAr = i18n.language === 'ar';

  useEffect(() => {
    const fetchMyCourses = async () => {
      try {
        const { data } = await api.get('/courses');
        setCourses(data.courses || []);
        if (data.courses?.length > 0) {
          handleSelectCourse(data.courses[0]);
        }
      } catch (e) {
      } finally {
        setLoading(false);
      }
    };
    fetchMyCourses();
  }, []);

  const handleSelectCourse = async (course) => {
    setSelectedCourse(course);
    setLecturesLoading(true);
    try {
      const { data } = await api.get(`/lectures/course/${course.id}`);
      setLectures(data.lectures || []);
    } catch (e) {
    } finally {
      setLecturesLoading(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>📚 {t('nav.myCourses')}</h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>
            {isAr ? 'المقررات الدراسية المسجل بها والمحاضرات والمراجع المتاحة' : 'Your enrolled courses and protected study materials'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="status-loading">
          <div className="spinner"></div>
        </div>
      ) : courses.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <p style={{ color: '#94a3b8' }}>
            {isAr ? 'لست مسجلاً في أي مقررات دراسية حالياً. تواصل مع إدارة الكلية.' : 'You are not enrolled in any courses yet. Contact the faculty admin.'}
          </p>
        </div>
      ) : (
        <div className="courses-split-layout">
          {/* Courses Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {courses.map((c) => {
              const title = isAr && c.title_ar ? c.title_ar : c.title;
              const isSelected = selectedCourse?.id === c.id;

              return (
                <div
                  key={c.id}
                  onClick={() => handleSelectCourse(c)}
                  className={`card ${isSelected ? 'course-card-active' : ''}`}
                  style={{
                    cursor: 'pointer',
                    borderColor: isSelected ? '#3b82f6' : '#334155',
                    background: isSelected ? 'rgba(59, 130, 246, 0.1)' : undefined,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', color: isSelected ? '#60a5fa' : '#f8fafc' }}>
                    {title}
                  </h4>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#94a3b8' }}>
                    <span>📑 {c.lectures_count || 0} {t('courses.lecturesCount')}</span>
                    <span>📝 {c.exams_count || 0} {t('courses.examsCount')}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Course Details & Lectures */}
          <div>
            {selectedCourse && (
              <div className="card">
                <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0', color: '#f8fafc' }}>
                  {isAr && selectedCourse.title_ar ? selectedCourse.title_ar : selectedCourse.title}
                </h3>
                <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: 1.6, marginBottom: '20px' }}>
                  {(isAr && selectedCourse.description_ar ? selectedCourse.description_ar : selectedCourse.description) ||
                    (isAr ? 'لا يوجد وصف للمقرر' : 'No description available')}
                </p>

                <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '14px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
                  📑 {t('lectures.title')}
                </h4>

                {lecturesLoading ? (
                  <div className="status-loading">
                    <div className="spinner"></div>
                  </div>
                ) : lectures.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '14px', padding: '24px 0', textAlign: 'center' }}>
                    {t('lectures.noLectures')}
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {lectures.map((lec, idx) => {
                      const titleText = isAr && lec.title_ar ? lec.title_ar : lec.title;
                      return (
                        <div
                          key={lec.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '14px 18px',
                            background: 'rgba(30, 41, 59, 0.5)',
                            borderRadius: '8px',
                            border: '1px solid #334155',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '24px' }}>📄</span>
                            <div>
                              <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '15px' }}>
                                {titleText}
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                {isAr ? 'محاضرة رقم' : 'Lecture'} #{lec.sort_order || idx + 1}
                                {lec.viewed && (
                                  <span style={{ marginInlineStart: '8px', color: '#10b981' }}>
                                    ✓ {isAr ? 'تم الاطلاع' : 'Viewed'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => setActivePdfUrl(lec.pdf_blob_url || `/api/lectures/${lec.id}/pdf`)}
                            className="btn-primary btn-sm"
                          >
                            👁️ {t('lectures.viewPdf')}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Protected Inline PDF Viewer Modal */}
      {activePdfUrl && (
        <div className="modal-backdrop" onClick={() => setActivePdfUrl(null)}>
          <div
            className="modal-card"
            style={{ width: '92vw', maxWidth: '1150px', height: '90vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3>🛡️ {t('lectures.viewPdf')}</h3>
                <span className="badge-emerald" style={{ fontSize: '11px' }}>
                  {t('lectures.viewOnlyNotice')}
                </span>
              </div>
              <button onClick={() => setActivePdfUrl(null)} className="modal-close-btn">✕</button>
            </div>

            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', borderRadius: '8px', background: '#0f172a' }}>
              <AntiScreenshotShield enabled={true}>
                <iframe
                  src={`${activePdfUrl}#toolbar=0&navpanes=0`}
                  title="Lecture PDF"
                  style={{ width: '100%', height: 'calc(90vh - 120px)', border: 'none' }}
                />
              </AntiScreenshotShield>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
