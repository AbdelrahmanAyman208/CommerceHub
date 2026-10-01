import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/client';
import AntiScreenshotShield from '../../components/common/AntiScreenshotShield';

export default function TakeExam({ examId, onFinish }) {
  const { t, i18n } = useTranslation();
  const [exam, setExam] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState('saved'); // 'saving' | 'saved'
  const [timeLeft, setTimeLeft] = useState(0);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [examResult, setExamResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const isAr = i18n.language === 'ar';
  const autosaveTimerRef = useRef(null);

  // Initialize or resume exam attempt
  useEffect(() => {
    const initExam = async () => {
      try {
        // Try starting or resuming
        let res;
        try {
          res = await api.post(`/exams/${examId}/start`);
        } catch (startErr) {
          // If already in progress, try resume
          res = await api.get(`/exams/${examId}/resume`);
        }

        const data = res.data;
        if (data.questions) {
          setQuestions(data.questions);
          setExam(data.exam);
          setAttempt(data.attempt);
          if (data.savedAnswers) {
            setAnswers(data.savedAnswers);
          }

          // Calculate remaining seconds
          const expiryTime = new Date(data.attempt.expiresAt || data.attempt.expires_at).getTime();
          const rem = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
          setTimeLeft(rem);
        } else if (data.attemptId) {
          // Resume endpoint
          const resumeRes = await api.get(`/exams/${examId}/resume`);
          setQuestions(resumeRes.data.questions);
          setExam(resumeRes.data.exam);
          setAttempt(resumeRes.data.attempt);
          setAnswers(resumeRes.data.savedAnswers || {});

          const expiryTime = new Date(resumeRes.data.attempt.expiresAt).getTime();
          const rem = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
          setTimeLeft(rem);
        }
      } catch (err) {
        setErrorMsg(err.response?.data?.error || 'Failed to initialize exam');
      } finally {
        setLoading(false);
      }
    };

    initExam();
  }, [examId]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0 || examResult) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinalSubmit(); // Auto-submit when time expires!
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, examResult]);

  // Debounced Autosave answers
  const triggerAutosave = (newAnswers) => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    setSavingStatus('saving');
    autosaveTimerRef.current = setTimeout(async () => {
      try {
        const payload = Object.entries(newAnswers).map(([qid, optKey]) => ({
          question_id: qid,
          selected_key: optKey,
        }));

        await api.put(`/exams/${examId}/autosave`, { answers: payload });
        setSavingStatus('saved');
      } catch (err) {
        console.error('Autosave error:', err);
        setSavingStatus('saved');
      }
    }, 1500); // 1.5s debounce after selection
  };

  const handleSelectOption = (questionId, optionKey) => {
    const updated = { ...answers, [questionId]: optionKey };
    setAnswers(updated);
    triggerAutosave(updated);
  };

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    try {
      // Flush any pending answers first
      const payload = Object.entries(answers).map(([qid, optKey]) => ({
        question_id: qid,
        selected_key: optKey,
      }));
      await api.put(`/exams/${examId}/autosave`, { answers: payload }).catch(() => {});

      const { data } = await api.post(`/exams/${examId}/submit`);
      setShowConfirmSubmit(false);
      setExamResult(data.gradeResult || { score: 0, passed: false });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit exam');
    } finally {
      setSubmitting(false);
    }
  };

  // Format time MM:SS
  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="status-loading" style={{ minHeight: '60vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="page-content">
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
          <h3 style={{ color: '#ef4444' }}>{errorMsg}</h3>
          <button onClick={onFinish} className="btn-secondary" style={{ marginTop: '20px' }}>
            ← {t('common.back')} {t('nav.myExams')}
          </button>
        </div>
      </div>
    );
  }

  // Result screen after submission
  if (examResult) {
    const passed = examResult.passed;
    return (
      <div className="page-content">
        <div className="card" style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>{passed ? '🎉' : '📑'}</div>
          <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#f8fafc', marginBottom: '8px' }}>
            {t('exams.examCompleted')}
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '15px', marginBottom: '24px' }}>
            {isAr && exam?.title_ar ? exam.title_ar : exam?.title}
          </p>

          <div
            style={{
              padding: '24px',
              borderRadius: '12px',
              background: passed ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: passed ? '2px solid #10b981' : '2px solid #ef4444',
              marginBottom: '24px',
            }}
          >
            <span style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>
              {t('exams.scoreResult')}
            </span>
            <div
              style={{
                fontSize: '44px',
                fontWeight: 900,
                color: passed ? '#10b981' : '#ef4444',
                margin: '10px 0',
              }}
            >
              {examResult.score} / {examResult.totalMarks || exam?.totalMarks}
            </div>

            <span
              className={passed ? 'badge-emerald' : 'badge-red'}
              style={{ fontSize: '15px', padding: '6px 18px', fontWeight: 800 }}
            >
              {passed ? `✓ ${t('exams.passed')}` : `✕ ${t('exams.failed')}`}
            </span>

            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '14px' }}>
              🎯 {t('exams.passMark')}: {examResult.passMark || exam?.passMark} (50%)
              <br />
              <small style={{ color: '#64748b' }}>{t('exams.passRuleNotice')}</small>
            </div>
          </div>

          <button onClick={onFinish} className="btn-primary" style={{ width: '100%', padding: '12px' }}>
            ← {isAr ? 'العودة إلى قائمة الامتحانات' : 'Return to Exams'}
          </button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIdx];
  const answeredCount = Object.keys(answers).length;
  const examTitle = isAr && exam?.title_ar ? exam.title_ar : exam?.title;

  return (
    <AntiScreenshotShield enabled={true}>
      <div className="exam-room" style={{ maxWidth: '1050px', margin: '0 auto', padding: '16px' }}>
        {/* Exam Header */}
        <header className="exam-header">
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f8fafc' }}>
              {examTitle}
            </h3>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              <span>
                🎯 {t('exams.passMark')}: {exam?.passMark} / {exam?.totalMarks} (50%)
              </span>
              <span>
                {savingStatus === 'saving' ? (
                  <span style={{ color: '#f59e0b' }}>⏳ {t('exams.saving')}</span>
                ) : (
                  <span style={{ color: '#10b981' }}>✓ {t('exams.saved')}</span>
                )}
              </span>
            </div>
          </div>

          {/* Synchronized Timer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 16px',
              borderRadius: '8px',
              background: timeLeft < 300 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.15)',
              border: timeLeft < 300 ? '1px solid #ef4444' : '1px solid rgba(59, 130, 246, 0.4)',
              color: timeLeft < 300 ? '#ef4444' : '#60a5fa',
              fontWeight: 800,
              fontSize: '18px',
            }}
          >
            <span>⏱️</span>
            <span>{formatTimer(timeLeft)}</span>
          </div>
        </header>

        <div className="exam-grid">
          {/* Main Question Box */}
          {currentQ && (
            <div className="card" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span className="id-badge" style={{ fontSize: '14px', padding: '6px 12px' }}>
                  {t('exams.question')} {currentIdx + 1} {t('exams.of')} {questions.length}
                </span>
                <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 700 }}>
                  +{currentQ.points} {t('exams.points')}
                </span>
              </div>

              <h4 style={{ fontSize: '18px', fontWeight: 600, color: '#f8fafc', lineHeight: 1.6, marginBottom: '24px' }}>
                {isAr && currentQ.text_ar ? currentQ.text_ar : currentQ.text}
              </h4>

              {/* Options List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {currentQ.options.map((opt) => {
                  const isSelected = answers[currentQ.id] === opt.key;
                  const optText = isAr && opt.text_ar ? opt.text_ar : opt.text;

                  return (
                    <div
                      key={opt.key}
                      onClick={() => handleSelectOption(currentQ.id, opt.key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        padding: '14px 18px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                        border: isSelected ? '2px solid #3b82f6' : '1px solid #334155',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '13px',
                          background: isSelected ? '#3b82f6' : '#334155',
                          color: '#fff',
                        }}
                      >
                        {opt.key}
                      </div>
                      <span style={{ fontSize: '15px', color: isSelected ? '#f8fafc' : '#cbd5e1' }}>
                        {optText}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Navigation Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
                <button
                  disabled={currentIdx === 0}
                  onClick={() => setCurrentIdx((prev) => prev - 1)}
                  className="btn-secondary"
                  style={{ opacity: currentIdx === 0 ? 0.4 : 1 }}
                >
                  ← {isAr ? 'السؤال السابق' : 'Previous'}
                </button>

                {currentIdx < questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentIdx((prev) => prev + 1)}
                    className="btn-primary"
                  >
                    {isAr ? 'السؤال التالي' : 'Next'} →
                  </button>
                ) : (
                  <button
                    onClick={() => setShowConfirmSubmit(true)}
                    className="btn-primary"
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                  >
                    🏁 {t('exams.submitExam')}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Question Navigator Side Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card">
              <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 12px 0', color: '#f8fafc' }}>
                {isAr ? 'قائمة الأسئلة' : 'Questions Navigator'}
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {questions.map((q, idx) => {
                  const isAnswered = !!answers[q.id];
                  const isCurrent = idx === currentIdx;

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIdx(idx)}
                      style={{
                        padding: '10px 0',
                        borderRadius: '8px',
                        border: isCurrent ? '2px solid #60a5fa' : '1px solid transparent',
                        background: isAnswered ? '#10b981' : '#334155',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8' }}>
                <span>✓ {answeredCount} {t('exams.answered')}</span>
                <span>○ {questions.length - answeredCount} {t('exams.unanswered')}</span>
              </div>
            </div>

            <button
              onClick={() => setShowConfirmSubmit(true)}
              className="btn-primary"
              style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #10b981, #059669)' }}
            >
              🏁 {t('exams.submitExam')}
            </button>
          </div>
        </div>

        {/* Submit Confirmation Modal */}
        {showConfirmSubmit && (
          <div className="modal-backdrop" onClick={() => setShowConfirmSubmit(false)}>
            <div className="modal-card" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>🏁 {t('exams.submitExam')}</h3>
                <button onClick={() => setShowConfirmSubmit(false)} className="modal-close-btn">✕</button>
              </div>

              <p style={{ color: '#cbd5e1', fontSize: '15px', lineHeight: 1.6, marginBottom: '16px' }}>
                {t('exams.confirmSubmit')}
              </p>

              <div style={{ padding: '12px 16px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', color: '#cbd5e1' }}>
                📊 {isAr ? 'عدد الأسئلة المجابة:' : 'Answered questions:'} <strong>{answeredCount}</strong> / {questions.length}
                {questions.length - answeredCount > 0 && (
                  <div style={{ color: '#f59e0b', marginTop: '4px' }}>
                    ⚠️ {isAr ? `لديك ${questions.length - answeredCount} أسئلة غير مجابة!` : `You have ${questions.length - answeredCount} unanswered questions!`}
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowConfirmSubmit(false)} className="btn-secondary">
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleFinalSubmit}
                  className="btn-primary"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                >
                  {submitting ? t('exams.submitting') : t('exams.submitExam')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AntiScreenshotShield>
  );
}
