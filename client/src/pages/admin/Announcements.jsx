import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/client';

export default function Announcements() {
  const { t, i18n } = useTranslation();
  const [courses, setCourses] = useState([]);
  const [targetType, setTargetType] = useState('all'); // 'all' or courseId
  const [title, setTitle] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [body, setBody] = useState('');
  const [bodyAr, setBodyAr] = useState('');
  const [sending, setSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const isAr = i18n.language === 'ar';

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const { data } = await api.get('/courses');
        setCourses(data.courses || []);
      } catch (e) {}
    };
    fetchCourses();
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    setSuccessMsg('');

    try {
      await api.post('/notifications', {
        course_id: targetType === 'all' ? null : targetType,
        title,
        title_ar: titleAr,
        body,
        body_ar: bodyAr,
        type: 'manual',
      });

      setSuccessMsg(isAr ? 'تم إرسال الإشعار بنجاح إلى جميع المستهدفين!' : 'Announcement broadcast successfully!');
      setTitle('');
      setTitleAr('');
      setBody('');
      setBodyAr('');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send announcement');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>📢 {t('nav.notifications')}</h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>
            {isAr
              ? 'إرسال إشعارات وتنبيهات فورية لجميع الطلاب أو طلاب مقرر محدد'
              : 'Broadcast instant announcements to all faculty students or a specific course'}
          </p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '680px' }}>
        {successMsg && (
          <div style={{ padding: '12px 16px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', borderRadius: '8px', color: '#10b981', marginBottom: '20px' }}>
            ✓ {successMsg}
          </div>
        )}

        <form onSubmit={handleSend}>
          <div className="form-group">
            <label>{isAr ? 'الفئة المستهدفة' : 'Audience Target'}</label>
            <select
              className="input-field"
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
            >
              <option value="all">🌍 {isAr ? 'جميع الطلاب بالكلية (Broadcast All)' : 'All Faculty Students (Broadcast All)'}</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  📚 {isAr && c.title_ar ? c.title_ar : c.title}
                </option>
              ))}
            </select>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '14px' }}>
              <div>
                <label>{isAr ? 'عنوان الإشعار (EN)' : 'Title (English)'}</label>
                <input
                  type="text"
                  className="input-field"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Schedule Update for Statistics"
                  required
                />
              </div>
              <div>
                <label>{isAr ? 'عنوان الإشعار (بالعربية)' : 'Title (Arabic)'}</label>
                <input
                  type="text"
                  className="input-field"
                  value={titleAr}
                  onChange={(e) => setTitleAr(e.target.value)}
                  placeholder="مثال: تعديل مواعيد محاضرة الإحصاء"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '14px' }}>
              <div>
                <label>{isAr ? 'نص الإشعار (EN)' : 'Message Body (English)'}</label>
                <textarea
                  className="input-field"
                  rows="4"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Enter announcement details..."
                  required
                ></textarea>
              </div>
              <div>
                <label>{isAr ? 'نص الإشعار (بالعربية)' : 'Message Body (Arabic)'}</label>
                <textarea
                  className="input-field"
                  rows="4"
                  value={bodyAr}
                  onChange={(e) => setBodyAr(e.target.value)}
                  placeholder="أدخل تفاصيل التنبيه..."
                ></textarea>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '24px' }}>
            <button type="submit" disabled={sending} className="btn-primary" style={{ width: '100%' }}>
              {sending ? t('loading') : (isAr ? '🚀 إرسال الإشعار الآن' : '🚀 Send Announcement Now')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
