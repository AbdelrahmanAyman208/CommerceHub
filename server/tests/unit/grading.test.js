const { shuffleArray } = require('../../src/utils/shuffle');

describe('Exam Grading & Pass Mark Logic (50% Rule)', () => {
  // Pure grading evaluator mirroring worker logic
  function calculateExamScore(questions, studentAnswers, totalMarks) {
    const answerMap = new Map();
    studentAnswers.forEach((ans) => answerMap.set(ans.question_id, ans.selected_key));

    let score = 0;
    for (const q of questions) {
      const selected = answerMap.get(q.id);
      if (selected && selected === q.correct_key) {
        score += q.points;
      }
    }

    const passMark = totalMarks * 0.5; // Always 50%
    const passed = score >= passMark;

    return { score, passMark, passed };
  }

  const sampleQuestions = [
    { id: 'q1', type: 'mcq', correct_key: 'B', points: 5.0 },
    { id: 'q2', type: 'true_false', correct_key: 'A', points: 5.0 },
    { id: 'q3', type: 'mcq', correct_key: 'C', points: 5.0 },
    { id: 'q4', type: 'true_false', correct_key: 'B', points: 5.0 },
  ];
  const totalMarks = 20.0;

  test('should pass when score is exactly 50% (10 out of 20)', () => {
    const answers = [
      { question_id: 'q1', selected_key: 'B' }, // 5 pts
      { question_id: 'q2', selected_key: 'A' }, // 5 pts
      { question_id: 'q3', selected_key: 'A' }, // wrong
      { question_id: 'q4', selected_key: 'A' }, // wrong
    ];

    const result = calculateExamScore(sampleQuestions, answers, totalMarks);
    expect(result.score).toBe(10.0);
    expect(result.passMark).toBe(10.0);
    expect(result.passed).toBe(true);
  });

  test('should fail when score is below 50% (5 out of 20)', () => {
    const answers = [
      { question_id: 'q1', selected_key: 'B' }, // 5 pts
      { question_id: 'q2', selected_key: 'B' }, // wrong
      { question_id: 'q3', selected_key: 'D' }, // wrong
      { question_id: 'q4', selected_key: 'A' }, // wrong
    ];

    const result = calculateExamScore(sampleQuestions, answers, totalMarks);
    expect(result.score).toBe(5.0);
    expect(result.passMark).toBe(10.0);
    expect(result.passed).toBe(false);
  });

  test('should pass with 100% when all answers are correct', () => {
    const answers = [
      { question_id: 'q1', selected_key: 'B' },
      { question_id: 'q2', selected_key: 'A' },
      { question_id: 'q3', selected_key: 'C' },
      { question_id: 'q4', selected_key: 'B' },
    ];

    const result = calculateExamScore(sampleQuestions, answers, totalMarks);
    expect(result.score).toBe(20.0);
    expect(result.passed).toBe(true);
  });

  test('should handle unanswered questions properly', () => {
    const answers = [
      { question_id: 'q1', selected_key: 'B' }, // 5 pts
    ];

    const result = calculateExamScore(sampleQuestions, answers, totalMarks);
    expect(result.score).toBe(5.0);
    expect(result.passed).toBe(false);
  });
});

describe('Question Randomization (Fisher-Yates)', () => {
  test('should preserve all elements after shuffle', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = shuffleArray(input);

    expect(shuffled).toHaveLength(input.length);
    expect([...shuffled].sort()).toEqual([...input].sort());
  });

  test('should not mutate original array', () => {
    const input = ['A', 'B', 'C', 'D'];
    const copy = [...input];
    shuffleArray(input);

    expect(input).toEqual(copy);
  });
});
