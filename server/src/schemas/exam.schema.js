const { z } = require('zod');

const createExamSchema = z.object({
  course_id: z.string().uuid(),
  title: z.string().min(2, 'Title is required'),
  title_ar: z.string().default(''),
  window_start: z.string().datetime(),
  window_end: z.string().datetime(),
  duration_minutes: z.coerce.number().int().min(1, 'Duration must be at least 1 minute'),
  total_marks: z.coerce.number().positive('Total marks must be greater than 0'),
  max_attempts: z.coerce.number().int().min(1, 'Max attempts must be at least 1').default(1),
  score_policy: z.enum(['best', 'latest']).default('best'),
  randomize_questions: z.boolean().default(false),
  randomize_options: z.boolean().default(false),
  published: z.boolean().default(false),
}).refine((data) => new Date(data.window_end) > new Date(data.window_start), {
  message: 'Window end date must be after window start date',
  path: ['window_end'],
});

const updateExamSchema = createExamSchema.partial();

const optionSchema = z.object({
  key: z.string().min(1),
  text: z.string().min(1),
  text_ar: z.string().default(''),
});

const createQuestionSchema = z.object({
  type: z.enum(['mcq', 'true_false']),
  text: z.string().min(1, 'Question text is required'),
  text_ar: z.string().default(''),
  options: z.array(optionSchema).min(2, 'Provide at least 2 options'),
  correct_key: z.string().min(1, 'Correct option key is required'),
  points: z.coerce.number().positive('Points must be positive'),
  sort_order: z.coerce.number().int().default(0),
});

const updateQuestionSchema = createQuestionSchema.partial();

const autosaveSchema = z.object({
  answers: z.array(
    z.object({
      question_id: z.string().uuid(),
      selected_key: z.string().nullable().optional(),
    })
  ),
});

const overrideScoreSchema = z.object({
  score: z.coerce.number().min(0, 'Score cannot be negative'),
});

module.exports = {
  createExamSchema,
  updateExamSchema,
  createQuestionSchema,
  updateQuestionSchema,
  autosaveSchema,
  overrideScoreSchema,
};
