const { z } = require('zod');

const createCourseSchema = z.object({
  title: z.string().min(2, 'Title is required'),
  title_ar: z.string().default(''),
  description: z.string().default(''),
  description_ar: z.string().default(''),
});

const updateCourseSchema = z.object({
  title: z.string().min(2).optional(),
  title_ar: z.string().optional(),
  description: z.string().optional(),
  description_ar: z.string().optional(),
});

const enrollStudentsSchema = z.object({
  student_ids: z.array(z.string().uuid()).min(1, 'Provide at least one student ID'),
});

module.exports = {
  createCourseSchema,
  updateCourseSchema,
  enrollStudentsSchema,
};
