import axios from 'axios';
import { mockDb } from './mockData';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 3000,
});

let isBackendDown = typeof window !== 'undefined' && (window.location.hostname.includes('github.io') || window.location.protocol === 'file:');

// In-memory active attempt store for standalone dev mode
let currentActiveAttempt = null;

// Transparent fallback router if backend is not running locally
function handleMockFallback(config) {
  const url = (config.url || '').replace(/^\/api/, '');
  const method = (config.method || 'get').toLowerCase();

  // 1. Auth: Login
  if (url.includes('/auth/login') && method === 'post') {
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data || {});
    const identifier = (body.identifier || '').trim().toLowerCase();
    const user = mockDb.users.find(
      (u) =>
        u.email.toLowerCase() === identifier ||
        (u.studentId && u.studentId.toLowerCase() === identifier)
    ) || mockDb.users[0];

    return {
      status: 200,
      data: {
        accessToken: `mock-token-${user.id}`,
        user,
      },
    };
  }

  // 2. Auth: Me
  if (url.includes('/auth/me')) {
    const token = localStorage.getItem('ch_access_token');
    if (token) {
      const userId = token.replace('mock-token-', '');
      const user = mockDb.users.find((u) => u.id === userId) || mockDb.users[0];
      return { status: 200, data: { user } };
    }
    return { status: 401, data: { error: 'Not authenticated' } };
  }

  // 3. Courses
  if (url === '/courses' || url === '/courses/') {
    if (method === 'get') {
      return { status: 200, data: { courses: mockDb.courses } };
    }
    if (method === 'post') {
      const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
      const newCourse = {
        id: `c${Date.now()}`,
        ...body,
        enrolled_students_count: 0,
        lectures_count: 0,
        exams_count: 0,
      };
      mockDb.courses.unshift(newCourse);
      return { status: 201, data: { course: newCourse } };
    }
  }

  if (url.includes('/courses/') && url.includes('/enroll')) {
    return { status: 200, data: { message: 'Enrolled successfully' } };
  }

  // 4. Lectures
  if (url.includes('/lectures/course/')) {
    const courseId = url.split('/lectures/course/')[1];
    const filtered = mockDb.lectures.filter((l) => l.course_id === courseId);
    return { status: 200, data: { lectures: filtered } };
  }

  if (url === '/lectures' && method === 'post') {
    let courseId = '';
    let title = 'New Lecture Material';
    let titleAr = '';
    let sortOrder = 1;
    let pdfBlobUrl = null;

    if (config.data instanceof FormData) {
      courseId = config.data.get('course_id') || '';
      title = config.data.get('title') || title;
      titleAr = config.data.get('title_ar') || '';
      sortOrder = parseInt(config.data.get('sort_order') || '1', 10);
      const file = config.data.get('pdf');
      if (file && typeof window !== 'undefined') {
        try {
          pdfBlobUrl = URL.createObjectURL(file);
        } catch (e) {}
      }
    } else {
      const body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data || {});
      courseId = body.course_id || '';
      title = body.title || title;
      titleAr = body.title_ar || '';
      sortOrder = parseInt(body.sort_order || '1', 10);
    }

    const newLec = {
      id: `l${Date.now()}`,
      course_id: courseId,
      title: title,
      title_ar: titleAr,
      sort_order: sortOrder,
      pdf_blob_url: pdfBlobUrl,
      created_at: new Date().toISOString(),
      viewed: false,
    };
    mockDb.lectures.push(newLec);

    const targetCourse = mockDb.courses.find((c) => c.id === courseId);
    if (targetCourse) {
      targetCourse.lectures_count = (targetCourse.lectures_count || 0) + 1;
    }

    return { status: 201, data: { lecture: newLec } };
  }

  // 5. Exams
  if (url === '/exams' || url === '/exams/') {
    if (method === 'get') {
      return { status: 200, data: { exams: mockDb.exams } };
    }
    if (method === 'post') {
      const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
      const totalMarks = parseFloat(body.total_marks || 20);
      const newExam = {
        id: `e${Date.now()}`,
        ...body,
        total_marks: totalMarks,
        pass_mark: totalMarks * 0.5, // 50% rule
        my_attempts_count: 0,
        my_best_score: null,
        published: true,
        question_count: 0,
        window_status: 'active',
        has_active_attempt: false,
      };
      mockDb.exams.unshift(newExam);
      mockDb.questions[newExam.id] = [];
      return { status: 201, data: { exam: newExam } };
    }
  }

  if (url.match(/\/exams\/e\d+$/)) {
    const examId = url.split('/exams/')[1];
    const exam = mockDb.exams.find((e) => e.id === examId) || mockDb.exams[0];
    const questions = mockDb.questions[examId] || mockDb.questions.e1;
    return { status: 200, data: { exam, questions } };
  }

  if (url.includes('/exams/') && url.includes('/publish')) {
    const examId = url.split('/exams/')[1].split('/publish')[0];
    const exam = mockDb.exams.find((e) => e.id === examId);
    if (exam) exam.published = !exam.published;
    return { status: 200, data: { exam } };
  }

  if (url.includes('/questions')) {
    return { status: 201, data: { message: 'Question saved' } };
  }

  // 6. Exam Taking Flow
  if (url.includes('/exams/') && url.includes('/start')) {
    const examId = url.split('/exams/')[1].split('/start')[0];
    const exam = mockDb.exams.find((e) => e.id === examId) || mockDb.exams[0];
    const questions = (mockDb.questions[exam.id] || mockDb.questions.e1).map((q) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      text_ar: q.text_ar,
      points: q.points,
      options: q.options,
    }));

    currentActiveAttempt = {
      attemptId: `att-${Date.now()}`,
      examId: exam.id,
      attemptNumber: (exam.my_attempts_count || 0) + 1,
      expiresAt: new Date(Date.now() + (exam.duration_minutes || 45) * 60 * 1000).toISOString(),
    };

    return {
      status: 201,
      data: {
        attempt: currentActiveAttempt,
        exam: {
          id: exam.id,
          title: exam.title,
          title_ar: exam.title_ar,
          totalMarks: exam.total_marks,
          passMark: exam.total_marks * 0.5, // 50%
        },
        questions,
      },
    };
  }

  if (url.includes('/exams/') && url.includes('/autosave')) {
    return { status: 200, data: { status: 'saved' } };
  }

  if (url.includes('/exams/') && url.includes('/submit')) {
    const examId = url.split('/exams/')[1].split('/submit')[0];
    const exam = mockDb.exams.find((e) => e.id === examId) || mockDb.exams[0];
    exam.my_attempts_count = (exam.my_attempts_count || 0) + 1;
    const score = 15.0; // Sample score
    const passMark = exam.total_marks * 0.5;
    const passed = score >= passMark;
    exam.my_best_score = score;

    return {
      status: 200,
      data: {
        gradeResult: {
          score,
          totalMarks: exam.total_marks,
          passMark,
          passed,
        },
      },
    };
  }

  // 7. Results
  if (url.includes('/results/my')) {
    return { status: 200, data: { results: mockDb.results } };
  }

  if (url.startsWith('/results')) {
    if (method === 'get') {
      return {
        status: 200,
        data: {
          data: mockDb.results,
          pagination: { total: mockDb.results.length, page: 1, limit: 20 },
        },
      };
    }
  }

  if (url.includes('/results/') && url.includes('/score') && method === 'put') {
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    const newScore = parseFloat(body.score);
    if (mockDb.results.length > 0) {
      mockDb.results[0].score = newScore;
      mockDb.results[0].passed = newScore >= mockDb.results[0].pass_mark;
    }
    return { status: 200, data: { message: 'Score updated by Doctor' } };
  }

  // 8. Students
  if (url.includes('/admin/students/import')) {
    let parsedStudents = [];
    if (config.data && typeof config.data.get === 'function') {
      const content = config.data.get('fileContent');
      if (content) {
        const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        if (lines.length > 1) {
          const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
          const nameIdx = headers.findIndex((h) => h.includes('name') || h.includes('اسم'));
          const emailIdx = headers.findIndex((h) => h.includes('email') || h.includes('بريد'));
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
            const name = nameIdx !== -1 ? cols[nameIdx] : cols[0];
            const email = emailIdx !== -1 ? cols[emailIdx] : cols[1];
            if (name && email) {
              parsedStudents.push({ name, email });
            }
          }
        }
      }
    }

    if (parsedStudents.length === 0) {
      parsedStudents = [
        { name: 'Ahmed Mahmoud', email: 'ahmed.mahmoud@commercehub.edu' },
        { name: 'Sara Ibrahim', email: 'sara.ibrahim@commercehub.edu' },
        { name: 'Mohamed Farouk', email: 'mohamed.farouk@commercehub.edu' },
        { name: 'Nouran Mostafa', email: 'nouran.mostafa@commercehub.edu' },
        { name: 'Khaled Hassan', email: 'khaled.hassan@commercehub.edu' },
      ];
    }

    const created = [];
    parsedStudents.forEach((s) => {
      const nextNum = 10000000 + mockDb.users.length + 1;
      const newStudent = {
        id: `u${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: s.name,
        email: s.email,
        studentId: nextNum.toString(),
        role: 'student',
        passwordChanged: false,
      };
      mockDb.users.push(newStudent);
      created.push({
        id: newStudent.id,
        name: newStudent.name,
        email: newStudent.email,
        student_id: newStudent.studentId,
        initialPassword: newStudent.studentId,
      });
    });

    return {
      status: 200,
      data: {
        successCount: created.length,
        errorCount: 0,
        created,
        errors: [],
      },
    };
  }

  if (url.startsWith('/admin/students')) {
    if (method === 'get') {
      const studentUsers = mockDb.users
        .filter((u) => u.role === 'student')
        .map((s) => ({
          id: s.id,
          student_id: s.studentId,
          name: s.name,
          email: s.email,
          enrolled_courses_count: 2,
          total_attempts: 1,
          average_score: 15.0,
          last_active_at: new Date().toISOString(),
        }));
      return { status: 200, data: { data: studentUsers, pagination: { total: studentUsers.length } } };
    }
    if (method === 'post') {
      const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
      const nextNum = 10000000 + mockDb.users.length + 1;
      const newStudent = {
        id: `u${Date.now()}`,
        name: body.name || 'New Student',
        email: body.email || `student${nextNum}@commercehub.edu`,
        studentId: nextNum.toString(),
        role: 'student',
        passwordChanged: true,
      };
      mockDb.users.push(newStudent);
      return { status: 201, data: { student: newStudent, initialPassword: newStudent.studentId } };
    }
  }

  // 9. Assistants
  if (url.startsWith('/admin/admins')) {
    if (method === 'get') {
      const admins = mockDb.users
        .filter((u) => u.role === 'admin' || u.role === 'super_admin')
        .map((a) => ({
          id: a.id,
          name: a.name,
          email: a.email,
          role: a.role,
          created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
        }));
      return { status: 200, data: { admins } };
    }
  }

  // 10. Notifications
  if (url.startsWith('/notifications')) {
    if (method === 'get') {
      return {
        status: 200,
        data: {
          notifications: mockDb.notifications,
          unreadCount: mockDb.notifications.filter((n) => !n.read).length,
        },
      };
    }
    if (method === 'post') {
      return { status: 201, data: { message: 'Notification sent' } };
    }
    if (url.includes('/read')) {
      return { status: 200, data: { message: 'Read' } };
    }
  }

  // 11. Analytics
  if (url.includes('/admin/analytics/overview')) {
    return { status: 200, data: { overview: mockDb.overview } };
  }
  if (url.includes('/admin/analytics/grade-distribution')) {
    return { status: 200, data: { distribution: mockDb.gradeDistribution } };
  }
  if (url.includes('/admin/analytics/pass-fail')) {
    return { status: 200, data: { passFail: mockDb.passFail } };
  }
  if (url.includes('/admin/analytics/pdf-engagement')) {
    return { status: 200, data: { engagement: mockDb.engagement } };
  }
  if (url.includes('/admin/analytics/at-risk')) {
    return { status: 200, data: { atRiskStudents: mockDb.atRisk } };
  }

  return { status: 200, data: {} };
}

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('ch_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // If backend was detected as down or proxy fails, intercept in request immediately
    if (isBackendDown) {
      const mock = handleMockFallback(config);
      // Return custom adapter
      config.adapter = () => {
        if (mock.status >= 400) {
          return Promise.reject({ response: mock });
        }
        return Promise.resolve(mock);
      };
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // If backend connection refused, 404/405 from static gh-pages, timeout, or 5xx proxy error
    if (
      !error.response ||
      error.response.status >= 400 ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ECONNABORTED'
    ) {
      isBackendDown = true;
      const mockRes = handleMockFallback(error.config);
      if (mockRes.status >= 400) {
        return Promise.reject({ response: mockRes });
      }
      return Promise.resolve(mockRes);
    }
    return Promise.reject(error);
  }
);

export default api;
