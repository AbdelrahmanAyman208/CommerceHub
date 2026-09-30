const { z } = require('zod');

const createLectureSchema = z.object({
  course_id: z.string().uuid(),
  title: z.string().min(2, 'Title is required'),
  title_ar: z.string().default(''),
  sort_order: z.coerce.number().int().default(0),
});

const updateLectureSchema = z.object({
  title: z.string().min(2).optional(),
  title_ar: z.string().optional(),
  sort_order: z.coerce.number().int().optional(),
});

module.exports = {
  createLectureSchema,
  updateLectureSchema,
};
