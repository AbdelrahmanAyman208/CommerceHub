import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/client';
import AntiScreenshotShield from '../../components/common/AntiScreenshotShield';

export default function Lectures() {
  const { t, i18n } = useTranslation();
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [lectures, setLectures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [activePdfUrl, setActivePdfUrl] = useState(null);

  // Form states
  const [title, setTitle] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [sortOrder, setSortOrder] = useState('1');
  const [pdfFile, setPdfFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const isAr = i18n.language === 'ar';

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const { data } = await api.get('/courses');
        setCourses(data.courses || []);
        if (data.courses?.length > 0) {
          setSelectedCourseId(data.courses[0].id);
        }
      } catch (e) {}
    };
    fetchCourses();
  }, []);

  const fetchLectures = async (courseId) => {
    if (!courseId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/lectures/course/${courseId}`);
      setLectures(data.lectures || []);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCourseId) {
      fetchLectures(selectedCourseId);
    }
  }, [selectedCourseId]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!pdfFile || !selectedCourseId) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('course_id', selectedCourseId);
    formData.append('title', title);
    formData.append('title_ar', titleAr);
    formData.append('sort_order', sortOrder);
    formData.append('pdf', pdfFile);

    try {
      await api.post('/lectures', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setShowUploadModal(false);
      setTitle('');
      setTitleAr('');
      setPdfFile(null);
      fetchLectures(selectedCourseId);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to upload PDF lecture');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteLecture = async (id) => {
    if (!window.confirm(isAr ? 'هل أنت متأكد من حذف هذه المحاضرة؟' : 'Are you sure you want to delete this lecture?')) return;
    try {
      await api.delete(`/lectures/${id}`);
      fetchLectures(selectedCourseId);
    } catch (err) {
      alert('Delete failed');
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>{t('lectures.title')}</h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>
            {isAr ? 'رفع وإدارة محاضرات الـ PDF المحمية للطلاب' : 'Upload and manage view-protected PDF lectures'}
          </p>
        </div>
        <button onClick={() => setShowUploadModal(true)} className="btn-primary" disabled={!selectedCourseId}>
          + {t('lectures.uploadTitle')}
        </button>
      </div>

      {/* Course Selector Filter */}
      <div className="card" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ fontWeight: 600, fontSize: '14px', color: '#cbd5e1' }}>
          {isAr ? 'اختر المقرر:' : 'Select Course:'}
        </span>
        <select
          className="input-field"
          style={{ maxWidth: '320px' }}
          value={selectedCourseId}
          onChange={(e) => setSelectedCourseId(e.target.value)}
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {isAr && c.title_ar ? c.title_ar : c.title}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="status-loading">
          <div className="spinner"></div>
        </div>
      ) : lectures.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <p style={{ color: '#94a3b8' }}>{t('lectures.noLectures')}</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>#</th>
                <th>{t('lectures.lectureTitle')}</th>
                <th>{isAr ? 'تاريخ الرفع' : 'Upload Date'}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {lectures.map((lec, idx) => {
                const titleText = isAr && lec.title_ar ? lec.title_ar : lec.title;
                return (
                  <tr key={lec.id}>
                    <td>
                      <span className="id-badge">{lec.sort_order || idx + 1}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '20px' }}>📄</span>
                        <span style={{ fontWeight: 600, color: '#f8fafc' }}>{titleText}</span>
                      </div>
                    </td>
                    <td style={{ color: '#94a3b8' }}>
                      {new Date(lec.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => setActivePdfUrl(lec.pdf_blob_url || `/api/lectures/${lec.id}/pdf`)}
                          className="btn-secondary btn-sm"
                        >
                          👁️ {t('lectures.viewPdf')}
                        </button>
                        <button
                          onClick={() => handleDeleteLecture(lec.id)}
                          className="btn-danger btn-sm"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Lecture PDF Modal */}
      {showUploadModal && (
        <div className="modal-backdrop" onClick={() => setShowUploadModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📄 {t('lectures.uploadTitle')}</h3>
              <button onClick={() => setShowUploadModal(false)} className="modal-close-btn">✕</button>
            </div>
            <form onSubmit={handleUpload}>
              <div className="form-group">
                <label>{t('lectures.lectureTitle')}</label>
                <input
                  type="text"
                  className="input-field"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Chapter 1: Introduction"
                  required
                />

                <label style={{ marginTop: '12px' }}>{t('lectures.lectureTitleAr')}</label>
                <input
                  type="text"
                  className="input-field"
                  value={titleAr}
                  onChange={(e) => setTitleAr(e.target.value)}
                  placeholder="مثال: الفصل الأول: مقدمة عامة"
                />

                <label style={{ marginTop: '12px' }}>{isAr ? 'الترتيب' : 'Sort Order'}</label>
                <input
                  type="number"
                  className="input-field"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  min="1"
                />

                <label style={{ marginTop: '12px' }}>{t('lectures.pdfFile')} (Max 20MB)</label>
                <input
                  type="file"
                  accept="application/pdf"
                  className="input-field"
                  onChange={(e) => setPdfFile(e.target.files[0])}
                  required
                />
              </div>

              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button type="button" onClick={() => setShowUploadModal(false)} className="btn-secondary">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={uploading || !pdfFile} className="btn-primary">
                  {uploading ? t('lectures.uploading') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Protected PDF Modal with Anti-Screenshot Shield */}
      {activePdfUrl && (
        <div className="modal-backdrop" onClick={() => setActivePdfUrl(null)}>
          <div
            className="modal-card"
            style={{ width: '90vw', maxWidth: '1100px', height: '88vh', display: 'flex', flexDirection: 'column' }}
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
                  style={{ width: '100%', height: 'calc(88vh - 120px)', border: 'none' }}
                />
              </AntiScreenshotShield>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
