-- CommerceHub Database Schema
-- Migration: 001_init.sql

BEGIN;

-- ════════════════════════════════════════════════════════════════════
-- ENUM TYPES
-- ════════════════════════════════════════════════════════════════════

CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'student');
CREATE TYPE lecture_log_action AS ENUM ('view', 'download');
CREATE TYPE question_type AS ENUM ('mcq', 'true_false');
CREATE TYPE notification_type AS ENUM (
  'exam_reminder', 'exam_missed', 'pdf_published',
  'exam_published', 'result_available', 'manual'
);
CREATE TYPE score_policy_type AS ENUM ('best', 'latest');

-- ════════════════════════════════════════════════════════════════════
-- SEQUENCE: 8-digit auto-generated student IDs (10000001, 10000002, ...)
-- ════════════════════════════════════════════════════════════════════

CREATE SEQUENCE student_id_seq START WITH 10000001 INCREMENT BY 1 MAXVALUE 99999999;

-- ════════════════════════════════════════════════════════════════════
-- TABLES
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  student_id VARCHAR(8),
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  password_changed BOOLEAN NOT NULL DEFAULT false,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  title_ar VARCHAR(255) NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  description_ar TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, course_id)
);

CREATE TABLE lectures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  title_ar VARCHAR(255) NOT NULL DEFAULT '',
  pdf_path VARCHAR(500) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE lecture_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lecture_id UUID NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
  action lecture_log_action NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE exams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  title_ar VARCHAR(255) NOT NULL DEFAULT '',
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  total_marks DECIMAL(6,2) NOT NULL CHECK (total_marks > 0),
  max_attempts INTEGER NOT NULL DEFAULT 1 CHECK (max_attempts >= 1),
  score_policy score_policy_type NOT NULL DEFAULT 'best',
  randomize_questions BOOLEAN NOT NULL DEFAULT false,
  randomize_options BOOLEAN NOT NULL DEFAULT false,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (window_end > window_start)
);

CREATE TABLE questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  type question_type NOT NULL,
  text TEXT NOT NULL,
  text_ar TEXT NOT NULL DEFAULT '',
  options JSONB NOT NULL DEFAULT '[]',
  correct_key VARCHAR(10) NOT NULL,
  points DECIMAL(5,2) NOT NULL CHECK (points > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE exam_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  score DECIMAL(6,2),
  graded BOOLEAN NOT NULL DEFAULT false,
  question_order JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, exam_id, attempt_number)
);

CREATE TABLE answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_key VARCHAR(10),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(attempt_id, question_id)
);

CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title VARCHAR(500) NOT NULL DEFAULT '',
  title_ar VARCHAR(500) NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  body_ar TEXT NOT NULL DEFAULT '',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════
-- INDEXES
-- ════════════════════════════════════════════════════════════════════

-- Users
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE UNIQUE INDEX idx_users_student_id ON users(student_id) WHERE student_id IS NOT NULL;

-- Enrollments
CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_course ON enrollments(course_id);

-- Lectures
CREATE INDEX idx_lectures_course ON lectures(course_id);
CREATE INDEX idx_lectures_course_sort ON lectures(course_id, sort_order);

-- Lecture logs
CREATE INDEX idx_lecture_logs_student ON lecture_logs(student_id);
CREATE INDEX idx_lecture_logs_lecture ON lecture_logs(lecture_id);
CREATE INDEX idx_lecture_logs_composite ON lecture_logs(student_id, lecture_id, action);

-- Exams
CREATE INDEX idx_exams_course ON exams(course_id);
CREATE INDEX idx_exams_published ON exams(published, window_start, window_end);

-- Questions
CREATE INDEX idx_questions_exam ON questions(exam_id);
CREATE INDEX idx_questions_exam_sort ON questions(exam_id, sort_order);

-- Exam attempts
CREATE INDEX idx_attempts_student ON exam_attempts(student_id);
CREATE INDEX idx_attempts_exam ON exam_attempts(exam_id);
CREATE INDEX idx_attempts_student_exam ON exam_attempts(student_id, exam_id);

-- Answers
CREATE INDEX idx_answers_attempt ON answers(attempt_id);
CREATE INDEX idx_answers_question ON answers(question_id);

-- Notifications
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read, created_at DESC);

-- ════════════════════════════════════════════════════════════════════
-- TRIGGER: auto-update updated_at
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_courses_updated_at
  BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_lectures_updated_at
  BEFORE UPDATE ON lectures FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_exams_updated_at
  BEFORE UPDATE ON exams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
