import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/client';

export default function ExamBuilder({ exam, onBack }) {
  const { t, i18n } = useTranslation();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Question form states
  const [qType, setQType] = useState('mcq');
  const [text, setText] = useState('');
  const [textAr, setTextAr] = useState('');
  const [points, setPoints] = useState('5');
  const [correctKey, setCorrectKey] = useState('A');

  // Options for MCQ
  const [options, setOptions] = useState([
    { key: 'A', text: '', text_ar: '' },
    { key: 'B', text: '', text_ar: '' },
    { key: 'C', text: '', text_ar: '' },
    { key: 'D', text: '', text_ar: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const isAr = i18n.language === 'ar';

  const fetchQuestions = async () => {
    try {
      const { data } = await api.get(`/exams/${exam.id}`);
      setQuestions(data.questions || []);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [exam.id]);

  const handleOptionChange = (idx, field, value) => {
    setOptions((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const payloadOptions =
      qType === 'true_false'
        ? [
            { key: 'A', text: 'True', text_ar: 'صواب' },
            { key: 'B', text: 'False', text_ar: 'خطأ' },
          ]
        : options;

    try {
      await api.post(`/exams/${exam.id}/questions`, {
        type: qType,
        text,
        text_ar: textAr,
        options: payloadOptions,
        correct_key: correctKey,
        points: parseFloat(points),
        sort_order: questions.length + 1,
      });

      setShowAddModal(false);
      setText('');
      setTextAr('');
      fetchQuestions();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add question');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteQuestion = async (qid) => {
    if (!window.confirm(isAr ? 'هل أنت متأكد من حذف هذا السؤال؟' : 'Are you sure you want to delete this question?')) return;
    try {
      await api.delete(`/exams/${exam.id}/questions/${qid}`);
      fetchQuestions();
    } catch (e) {
      alert('Delete failed');
    }
  };

  const examTitle = isAr && exam.title_ar ? exam.title_ar : exam.title;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <button onClick={onBack} className="btn-secondary btn-sm" style={{ marginBottom: '8px' }}>
            ← {t('common.back')} {isAr ? 'إلى الامتحانات' : 'to Exams'}
          </button>
          <h2>{t('questions.builderTitle')} — {examTitle}</h2>
          <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '13px', color: '#94a3b8' }}>
            <span>💯 {t('exams.totalMarks')}: {exam.total_marks}</span>
            <span style={{ color: '#10b981', fontWeight: 600 }}>🎯 {t('exams.passMark')}: {exam.pass_mark} (50%)</span>
            <span>📝 {isAr ? 'عدد الأسئلة:' : 'Questions:'} {questions.length}</span>
          </div>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary">
          + {t('questions.addQuestion')}
        </button>
      </div>

      {loading ? (
        <div className="status-loading">
          <div className="spinner"></div>
        </div>
      ) : questions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <p style={{ color: '#94a3b8' }}>
            {isAr ? 'لا توجد أسئلة مضافة لهذا الامتحان بعد. اضغط على "إضافة سؤال" للبدء.' : 'No questions added yet. Click "Add Question" to start building.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {questions.map((q, idx) => {
            const qOpts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
            const qText = isAr && q.text_ar ? q.text_ar : q.text;

            return (
              <div key={q.id} className="card question-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="id-badge">Q{idx + 1}</span>
                    <span className="badge-blue" style={{ fontSize: '11px' }}>
                      {q.type === 'mcq' ? t('questions.mcq') : t('questions.trueFalse')}
                    </span>
                    <span style={{ color: '#10b981', fontSize: '12px', fontWeight: 700 }}>
                      +{q.points} {t('exams.points')}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteQuestion(q.id)}
                    className="btn-danger btn-sm"
                  >
                    🗑️
                  </button>
                </div>

                <p style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', margin: '14px 0 10px 0' }}>
                  {qText}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                  {qOpts.map((opt) => {
                    const optText = isAr && opt.text_ar ? opt.text_ar : opt.text;
                    const isCorrect = opt.key === q.correct_key;

                    return (
                      <div
                        key={opt.key}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '8px',
                          background: isCorrect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(30, 41, 59, 0.5)',
                          border: isCorrect ? '1.5px solid #10b981' : '1px solid #334155',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 800,
                            color: isCorrect ? '#10b981' : '#94a3b8',
                            fontSize: '13px',
                          }}
                        >
                          {opt.key}.
                        </span>
                        <span style={{ fontSize: '13px', color: isCorrect ? '#f8fafc' : '#cbd5e1' }}>
                          {optText}
                        </span>
                        {isCorrect && (
                          <span style={{ marginInlineStart: 'auto', color: '#10b981', fontSize: '12px', fontWeight: 700 }}>
                            ✓ {t('questions.correctAnswer')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Question Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('questions.addQuestion')}</h3>
              <button onClick={() => setShowAddModal(false)} className="modal-close-btn">✕</button>
            </div>

            <form onSubmit={handleCreateQuestion}>
              <div className="form-group">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label>{t('questions.type')}</label>
                    <select
                      className="input-field"
                      value={qType}
                      onChange={(e) => {
                        setQType(e.target.value);
                        setCorrectKey('A');
                      }}
                    >
                      <option value="mcq">{t('questions.mcq')}</option>
                      <option value="true_false">{t('questions.trueFalse')}</option>
                    </select>
                  </div>
                  <div>
                    <label>{t('questions.points')}</label>
                    <input
                      type="number"
                      className="input-field"
                      value={points}
                      onChange={(e) => setPoints(e.target.value)}
                      min="1"
                      step="0.5"
                      required
                    />
                  </div>
                </div>

                <label style={{ marginTop: '12px' }}>{t('questions.questionText')}</label>
                <textarea
                  className="input-field"
                  rows="2"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. Which accounting principle requires matching revenue with expenses?"
                  required
                />

                <label style={{ marginTop: '12px' }}>{t('questions.questionTextAr')}</label>
                <textarea
                  className="input-field"
                  rows="2"
                  value={textAr}
                  onChange={(e) => setTextAr(e.target.value)}
                  placeholder="مثال: أي المبادئ المحاسبية يقتضي مقابلة الإيرادات بالمصروفات؟"
                />

                {/* Options Input */}
                {qType === 'mcq' ? (
                  <div style={{ marginTop: '16px' }}>
                    <label style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '8px', display: 'block' }}>
                      {isAr ? 'خيارات الإجابة والحل الصحيح:' : 'Options & Correct Answer:'}
                    </label>
                    {options.map((opt, i) => (
                      <div key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <input
                          type="radio"
                          name="correctOption"
                          checked={correctKey === opt.key}
                          onChange={() => setCorrectKey(opt.key)}
                          title="Mark as correct answer"
                        />
                        <span style={{ fontWeight: 700, color: '#60a5fa', width: '20px' }}>{opt.key}</span>
                        <input
                          type="text"
                          className="input-field"
                          placeholder={`Option ${opt.key} (EN)`}
                          value={opt.text}
                          onChange={(e) => handleOptionChange(i, 'text', e.target.value)}
                          required
                        />
                        <input
                          type="text"
                          className="input-field"
                          placeholder={`الخيار ${opt.key} (عربي)`}
                          value={opt.text_ar}
                          onChange={(e) => handleOptionChange(i, 'text_ar', e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ marginTop: '16px' }}>
                    <label style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '8px', display: 'block' }}>
                      {t('questions.correctAnswer')}
                    </label>
                    <div style={{ display: 'flex', gap: '20px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#cbd5e1' }}>
                        <input
                          type="radio"
                          name="tfOption"
                          value="A"
                          checked={correctKey === 'A'}
                          onChange={() => setCorrectKey('A')}
                        />
                        {isAr ? 'صواب (True)' : 'True'}
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#cbd5e1' }}>
                        <input
                          type="radio"
                          name="tfOption"
                          value="B"
                          checked={correctKey === 'B'}
                          onChange={() => setCorrectKey('B')}
                        />
                        {isAr ? 'خطأ (False)' : 'False'}
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-actions" style={{ marginTop: '24px' }}>
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
    </div>
  );
}
