/**
 * Seed script — creates initial dev data.
 * Idempotent: skips if users already exist.
 */
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const SALT_ROUNDS = 12;

// Minimal valid PDF binary buffer
const MINIMAL_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
  '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n' +
  '0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n'
);

async function seed() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
    if (rows[0].count > 0) {
      console.log('Database already seeded. Skipping.');
      await pool.end();
      return;
    }

    console.log('Seeding database with rich sample data...\n');

    const adminHash = await bcrypt.hash('admin123', SALT_ROUNDS);
    const studentHash = await bcrypt.hash('student123', SALT_ROUNDS);

    // 1. Super Admin (the Doctor/Lecturer)
    const {
      rows: [superAdmin],
    } = await pool.query(
      `INSERT INTO users (email, name, password_hash, role)
       VALUES ('admin@commercehub.edu', 'Dr. Ahmed Hassan', $1, 'super_admin')
       RETURNING id, email`,
      [adminHash]
    );
    console.log(`  ✓ Super Admin (Doctor): ${superAdmin.email}`);

    // 2. Assistant Admin
    const {
      rows: [assistant],
    } = await pool.query(
      `INSERT INTO users (email, name, password_hash, role)
       VALUES ('assistant@commercehub.edu', 'Sara Ali', $1, 'admin')
       RETURNING id, email`,
      [adminHash]
    );
    console.log(`  ✓ Assistant Admin: ${assistant.email}`);

    // 3. Students (5)
    const students = [
      { email: 'student1@commercehub.edu', name: 'Mohamed Ibrahim' },
      { email: 'student2@commercehub.edu', name: 'Fatima Al-Zahra' },
      { email: 'student3@commercehub.edu', name: 'Omar Khaled' },
      { email: 'student4@commercehub.edu', name: 'Nour El-Din' },
      { email: 'student5@commercehub.edu', name: 'Layla Mahmoud' },
    ];

    const studentIds = [];
    const studentRecords = [];
    for (const s of students) {
      const {
        rows: [created],
      } = await pool.query(
        `INSERT INTO users (email, student_id, name, password_hash, role, password_changed)
         VALUES ($1, LPAD(nextval('student_id_seq')::TEXT, 8, '0'), $2, $3, 'student', true)
         RETURNING id, email, student_id, name`,
        [s.email, s.name, studentHash]
      );
      studentIds.push(created.id);
      studentRecords.push(created);
      console.log(`  ✓ Student: ${created.email} (ID: ${created.student_id})`);
    }

    // 4. Courses (2)
    const {
      rows: [course1],
    } = await pool.query(
      `INSERT INTO courses (title, title_ar, description, description_ar)
       VALUES (
         'Introduction to Statistics',
         'مقدمة في الإحصاء',
         'Fundamental concepts of statistics and probability for commerce students.',
         'المفاهيم الأساسية في الإحصاء والاحتمالات لطلاب التجارة.'
       ) RETURNING id, title`
    );

    const {
      rows: [course2],
    } = await pool.query(
      `INSERT INTO courses (title, title_ar, description, description_ar)
       VALUES (
         'Financial Accounting',
         'المحاسبة المالية',
         'Principles of financial accounting, reporting, and analysis.',
         'مبادئ المحاسبة المالية والتقارير والتحليل المالي.'
       ) RETURNING id, title`
    );

    // 5. Enroll students
    for (const sid of studentIds) {
      await pool.query(
        `INSERT INTO enrollments (student_id, course_id) VALUES ($1, $2), ($1, $3)`,
        [sid, course1.id, course2.id]
      );
    }
    console.log(`  ✓ Enrolled 5 students in both courses`);

    // 6. Sample PDFs on disk
    const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
    const pdfDir = path.join(uploadDir, 'pdfs');
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }
    const samplePdfName1 = 'lecture-stats-ch1.pdf';
    const samplePdfName2 = 'lecture-accounting-ch1.pdf';
    fs.writeFileSync(path.join(pdfDir, samplePdfName1), MINIMAL_PDF);
    fs.writeFileSync(path.join(pdfDir, samplePdfName2), MINIMAL_PDF);

    // 7. Insert lectures
    const {
      rows: [lec1],
    } = await pool.query(
      `INSERT INTO lectures (course_id, title, title_ar, pdf_path, sort_order)
       VALUES ($1, 'Chapter 1: Descriptive Statistics', 'الفصل الأول: الإحصاء الوصفي', $2, 1)
       RETURNING id`,
      [course1.id, samplePdfName1]
    );

    const {
      rows: [lec2],
    } = await pool.query(
      `INSERT INTO lectures (course_id, title, title_ar, pdf_path, sort_order)
       VALUES ($1, 'Chapter 2: Probability Distributions', 'الفصل الثاني: التوزيعات الاحتمالية', $2, 2)
       RETURNING id`,
      [course1.id, samplePdfName1]
    );

    await pool.query(
      `INSERT INTO lectures (course_id, title, title_ar, pdf_path, sort_order)
       VALUES ($1, 'Unit 1: The Accounting Equation', 'الوحدة الأولى: معادلة الميزانية', $2, 1)`,
      [course2.id, samplePdfName2]
    );

    // 8. Lecture logs for student engagement stats
    for (let i = 0; i < 4; i++) {
      await pool.query(
        `INSERT INTO lecture_logs (student_id, lecture_id, action) VALUES ($1, $2, 'view')`,
        [studentIds[i], lec1.id]
      );
    }
    await pool.query(
      `INSERT INTO lecture_logs (student_id, lecture_id, action) VALUES ($1, $2, 'view')`,
      [studentIds[0], lec2.id]
    );

    // 9. Create Active Exam (20 points, 50% pass = 10 points, max 2 attempts)
    const windowStart = new Date(Date.now() - 24 * 3600 * 1000);
    const windowEnd = new Date(Date.now() + 7 * 24 * 3600 * 1000);

    const {
      rows: [exam1],
    } = await pool.query(
      `INSERT INTO exams (
        course_id, title, title_ar, window_start, window_end,
        duration_minutes, total_marks, max_attempts, score_policy,
        randomize_questions, randomize_options, published
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'best', true, true, true)
      RETURNING id, title`,
      [
        course1.id,
        'Midterm Exam - Business Statistics',
        'امتحان منتصف الفصل - إحصاء الأعمال',
        windowStart.toISOString(),
        windowEnd.toISOString(),
        45,
        20.0,
        2, // Admin selected 2 attempts
      ]
    );
    console.log(`  ✓ Exam: ${exam1.title} (Total Marks: 20, Pass Mark: 10, Attempts: 2)`);

    // 10. Questions for Exam 1 (4 questions × 5 points = 20 points)
    const q1 = await pool.query(
      `INSERT INTO questions (exam_id, type, text, text_ar, options, correct_key, points, sort_order)
       VALUES ($1, 'mcq', $2, $3, $4, 'B', 5.0, 1) RETURNING id`,
      [
        exam1.id,
        'What measure of central tendency is most affected by extreme outliers?',
        'أي مقاييس النزعة المركزية يتأثر بشدة بالقيم المتطرفة؟',
        JSON.stringify([
          { key: 'A', text: 'Median', text_ar: 'الوسيط' },
          { key: 'B', text: 'Mean', text_ar: 'الوسط الحسابي' },
          { key: 'C', text: 'Mode', text_ar: 'المنوال' },
          { key: 'D', text: 'Variance', text_ar: 'التباين' },
        ]),
      ]
    );

    const q2 = await pool.query(
      `INSERT INTO questions (exam_id, type, text, text_ar, options, correct_key, points, sort_order)
       VALUES ($1, 'true_false', $2, $3, $4, 'A', 5.0, 2) RETURNING id`,
      [
        exam1.id,
        'The sum of probabilities in a discrete probability distribution always equals 1.',
        'مجموع الاحتمالات في التوزيع الاحتمالي المنفصل يساوي دائماً 1.',
        JSON.stringify([
          { key: 'A', text: 'True', text_ar: 'صواب' },
          { key: 'B', text: 'False', text_ar: 'خطأ' },
        ]),
      ]
    );

    const q3 = await pool.query(
      `INSERT INTO questions (exam_id, type, text, text_ar, options, correct_key, points, sort_order)
       VALUES ($1, 'mcq', $2, $3, $4, 'C', 5.0, 3) RETURNING id`,
      [
        exam1.id,
        'If the correlation coefficient r = -0.92, this indicates:',
        'إذا كان معامل الارتباط r = -0.92، فهذا يشير إلى:',
        JSON.stringify([
          { key: 'A', text: 'No relationship', text_ar: 'لا توجد علاقة' },
          { key: 'B', text: 'Weak positive relationship', text_ar: 'علاقة طردية ضعيفة' },
          { key: 'C', text: 'Strong negative relationship', text_ar: 'علاقة عكسية قوية' },
          { key: 'D', text: 'Non-linear relationship', text_ar: 'علاقة غير خطية' },
        ]),
      ]
    );

    const q4 = await pool.query(
      `INSERT INTO questions (exam_id, type, text, text_ar, options, correct_key, points, sort_order)
       VALUES ($1, 'true_false', $2, $3, $4, 'B', 5.0, 4) RETURNING id`,
      [
        exam1.id,
        'Standard deviation can have a negative value.',
        'يمكن أن يكون للانحراف المعياري قيمة سالبة.',
        JSON.stringify([
          { key: 'A', text: 'True', text_ar: 'صواب' },
          { key: 'B', text: 'False', text_ar: 'خطأ' },
        ]),
      ]
    );

    // 11. Seed a few graded attempts so results & analytics dashboard have data
    // Student 1 passed (15 / 20)
    const {
      rows: [att1],
    } = await pool.query(
      `INSERT INTO exam_attempts (student_id, exam_id, attempt_number, started_at, expires_at, submitted_at, score, graded)
       VALUES ($1, $2, 1, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour', 15.0, true)
       RETURNING id`,
      [studentIds[0], exam1.id]
    );
    await pool.query(
      `INSERT INTO answers (attempt_id, question_id, selected_key)
       VALUES ($1, $2, 'B'), ($1, $3, 'A'), ($1, $4, 'C'), ($1, $5, 'A')`,
      [att1.id, q1.rows[0].id, q2.rows[0].id, q3.rows[0].id, q4.rows[0].id]
    );

    // Student 2 failed (5 / 20) (< 50% pass mark)
    const {
      rows: [att2],
    } = await pool.query(
      `INSERT INTO exam_attempts (student_id, exam_id, attempt_number, started_at, expires_at, submitted_at, score, graded)
       VALUES ($1, $2, 1, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours', 5.0, true)
       RETURNING id`,
      [studentIds[1], exam1.id]
    );
    await pool.query(
      `INSERT INTO answers (attempt_id, question_id, selected_key)
       VALUES ($1, $2, 'A'), ($1, $3, 'A'), ($1, $4, 'A'), ($1, $5, 'A')`,
      [att2.id, q1.rows[0].id, q2.rows[0].id, q3.rows[0].id, q4.rows[0].id]
    );

    // 12. Seed notifications
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, title_ar, body, body_ar)
       VALUES (NULL, 'manual', 'Welcome to CommerceHub Platform', 'مرحباً بكم في منصة CommerceHub',
       'Welcome all students to the faculty semester learning system.',
       'أهلاً بجميع الطلاب في منصة الفصل الدراسي بكلية التجارة.')`
    );

    await pool.query(
      `INSERT INTO notifications (user_id, type, title, title_ar, body, body_ar)
       VALUES ($1, 'result_available',
       'Result for Midterm Exam - Business Statistics: 15 / 20 (Passed)',
       'نتيجة امتحان منتصف الفصل - إحصاء الأعمال: 15 / 20 (ناجح)',
       'You scored 15 out of 20. Pass mark is 10 (50%).',
       'حصلت على 15 من 20. درجة النجاح المطلوبة هي 10 (50%).')`,
      [studentIds[0]]
    );

    console.log('\n══════════════════════════════════════════');
    console.log('  Seed complete! Ready for login:');
    console.log('──────────────────────────────────────────');
    console.log('  Super Admin (Doctor): admin@commercehub.edu / admin123');
    console.log('  Assistant:            assistant@commercehub.edu / admin123');
    console.log(`  Student 1:            ${studentRecords[0].email} (ID: ${studentRecords[0].student_id}) / student123`);
    console.log(`  Student 2:            ${studentRecords[1].email} (ID: ${studentRecords[1].student_id}) / student123`);
    console.log('══════════════════════════════════════════\n');
  } catch (err) {
    console.error('Seed failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
