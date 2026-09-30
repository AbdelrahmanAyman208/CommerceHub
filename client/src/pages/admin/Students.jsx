import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/client';

export default function Students() {
  const { t, i18n } = useTranslation();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [createdStudentInfo, setCreatedStudentInfo] = useState(null);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [csvResult, setCsvResult] = useState(null);

  const isAr = i18n.language === 'ar';

  const fetchStudents = async () => {
    try {
      const { data } = await api.get(`/admin/students?search=${encodeURIComponent(search)}&limit=50`);
      setStudents(data.data || []);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [search]);

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await api.post('/admin/students', {
        name,
        email,
        password: password || undefined,
      });

      setCreatedStudentInfo({
        student: data.student,
        initialPassword: data.initialPassword,
      });
      setName('');
      setEmail('');
      setPassword('');
      fetchStudents();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add student');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCsvImport = async (e) => {
    e.preventDefault();
    if (!csvFile) return;

    setSubmitting(true);
    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      if (typeof csvFile.text === 'function') {
        const text = await csvFile.text();
        formData.append('fileContent', text);
      }
      const { data } = await api.post('/admin/students/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCsvResult(data);
      fetchStudents();
    } catch (err) {
      alert(err.response?.data?.error || 'CSV import failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStudent = async (id) => {
    if (!window.confirm(isAr ? 'هل أنت متأكد من حذف هذا الطالب؟' : 'Are you sure you want to delete this student?')) return;
    try {
      await api.delete(`/admin/students/${id}`);
      fetchStudents();
    } catch (e) {
      alert('Delete failed');
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>{t('students.title')}</h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>
            {isAr
              ? 'سجل الطلاب بالكلية، أرقام القيد الموحدة (8 أرقام)، والمقررات المسجلة'
              : 'Faculty student roster with uniform 8-digit IDs and enrolled course progress'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowCsvModal(true)} className="btn-secondary">
            📥 {t('students.importCsv')}
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            + {t('students.addStudent')}
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <input
          type="text"
          className="input-field"
          style={{ maxWidth: '380px' }}
          placeholder={isAr ? 'بحث بالاسم، البريد، أو الرقم الجامعي...' : 'Search by name, email, or 8-digit ID...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="status-loading">
          <div className="spinner"></div>
        </div>
      ) : students.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <p style={{ color: '#94a3b8' }}>{t('students.noStudents')}</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('studentId')} (8 {isAr ? 'أرقام' : 'digits'})</th>
                <th>{t('students.name')}</th>
                <th>{t('students.email')}</th>
                <th>{isAr ? 'المقررات' : 'Courses'}</th>
                <th>{isAr ? 'الامتحانات' : 'Exams'}</th>
                <th>{t('stats.averageScore')}</th>
                <th>{isAr ? 'آخر نشاط' : 'Last Active'}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="id-badge">{s.student_id}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#f8fafc' }}>{s.name}</div>
                  </td>
                  <td style={{ color: '#94a3b8' }}>{s.email}</td>
                  <td>{s.enrolled_courses_count || 0}</td>
                  <td>{s.total_attempts || 0}</td>
                  <td>
                    <span style={{ fontWeight: 700, color: s.average_score >= 50 ? '#10b981' : '#f59e0b' }}>
                      {s.average_score || 0}
                    </span>
                  </td>
                  <td style={{ color: '#94a3b8', fontSize: '12px' }}>
                    {s.last_active_at ? new Date(s.last_active_at).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <button
                      onClick={() => handleDeleteStudent(s.id)}
                      className="btn-danger btn-sm"
                      title={t('common.delete')}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => { setShowAddModal(false); setCreatedStudentInfo(null); }}>
          <div className="modal-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🎓 {t('students.addStudent')}</h3>
              <button onClick={() => { setShowAddModal(false); setCreatedStudentInfo(null); }} className="modal-close-btn">✕</button>
            </div>

            {createdStudentInfo ? (
              <div style={{ padding: '16px 0' }}>
                <div style={{ padding: '14px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', borderRadius: '8px', marginBottom: '16px' }}>
                  <h4 style={{ color: '#10b981', margin: '0 0 6px 0' }}>✓ {isAr ? 'تم إنشاء حساب الطالب بنجاح!' : 'Student account created!'}</h4>
                  <div style={{ fontSize: '14px', color: '#f8fafc' }}>
                    <strong>{t('studentId')}:</strong>{' '}
                    <span className="id-badge" style={{ fontSize: '15px' }}>{createdStudentInfo.student.student_id}</span>
                  </div>
                  <div style={{ fontSize: '14px', color: '#f8fafc', marginTop: '6px' }}>
                    <strong>{t('password')}:</strong> <code>{createdStudentInfo.initialPassword}</code>
                  </div>
                </div>
                <button
                  onClick={() => setCreatedStudentInfo(null)}
                  className="btn-secondary"
                  style={{ width: '100%' }}
                >
                  {isAr ? 'إضافة طالب آخر' : 'Add another student'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleAddStudent}>
                <div className="form-group">
                  <div style={{ padding: '10px 14px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: '#60a5fa' }}>
                    ℹ️ {t('students.autoIdNotice')}
                  </div>

                  <label>{t('students.name')}</label>
                  <input
                    type="text"
                    className="input-field"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Youssef Nabil"
                    required
                  />

                  <label style={{ marginTop: '12px' }}>{t('students.email')}</label>
                  <input
                    type="email"
                    className="input-field"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@commercehub.edu"
                    required
                  />

                  <label style={{ marginTop: '12px' }}>{t('password')} ({isAr ? 'اختياري: الافتراضي نفس الرقم الجامعي' : 'Optional: defaults to Student ID'})</label>
                  <input
                    type="text"
                    className="input-field"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Leave empty to use student ID"
                  />
                </div>

                <div className="modal-actions" style={{ marginTop: '20px' }}>
                  <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary">
                    {t('common.cancel')}
                  </button>
                  <button type="submit" disabled={submitting} className="btn-primary">
                    {submitting ? t('loading') : t('common.save')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* CSV Bulk Import Modal */}
      {showCsvModal && (
        <div className="modal-backdrop" onClick={() => { setShowCsvModal(false); setCsvResult(null); }}>
          <div className="modal-card" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📥 {t('students.importCsv')}</h3>
              <button onClick={() => { setShowCsvModal(false); setCsvResult(null); }} className="modal-close-btn">✕</button>
            </div>

            {csvResult ? (
              <div style={{ padding: '16px 0' }}>
                <div style={{ padding: '14px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', borderRadius: '8px', marginBottom: '16px' }}>
                  <h4 style={{ color: '#10b981', margin: '0 0 6px 0' }}>
                    ✓ {isAr ? `تم استيراد ${csvResult.successCount} طالب بنجاح!` : `Imported ${csvResult.successCount} students successfully!`}
                  </h4>
                  {csvResult.errorCount > 0 && (
                    <div style={{ color: '#ef4444', fontSize: '13px', marginTop: '6px' }}>
                      ⚠️ {csvResult.errorCount} {isAr ? 'سجلات بها أخطاء أو مكررة' : 'errors/duplicates'}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { setShowCsvModal(false); setCsvResult(null); }}
                  className="btn-primary"
                  style={{ width: '100%' }}
                >
                  {t('common.close')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleCsvImport}>
                <div className="form-group">
                  <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.5, marginBottom: '14px' }}>
                    {t('students.csvInstructions')}
                  </p>

                  <div style={{ marginBottom: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <a
                      href="/students_sample.csv"
                      download="students_sample.csv"
                      className="btn-secondary"
                      style={{ fontSize: '12px', padding: '6px 12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      📥 {isAr ? 'تحميل نموذج CSV تجريبي' : 'Download Sample CSV'}
                    </a>
                  </div>

                  <div style={{ padding: '10px 14px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: '#60a5fa' }}>
                    ℹ️ {t('students.autoIdNotice')}
                  </div>

                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="input-field"
                    onChange={(e) => setCsvFile(e.target.files[0])}
                    required
                  />
                </div>

                <div className="modal-actions" style={{ marginTop: '20px' }}>
                  <button type="button" onClick={() => setShowCsvModal(false)} className="btn-secondary">
                    {t('common.cancel')}
                  </button>
                  <button type="submit" disabled={submitting || !csvFile} className="btn-primary">
                    {submitting ? t('loading') : t('students.importCsv')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
