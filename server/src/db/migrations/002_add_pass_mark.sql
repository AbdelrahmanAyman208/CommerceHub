-- Migration 002: Add custom pass_mark column to exams
ALTER TABLE exams ADD COLUMN IF NOT EXISTS pass_mark DECIMAL(6,2);
UPDATE exams SET pass_mark = ROUND(total_marks * 0.5, 2) WHERE pass_mark IS NULL;
