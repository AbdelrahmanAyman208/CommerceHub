const { z } = require('zod');

const sendNotificationSchema = z.object({
  user_id: z.string().uuid().nullable().optional(), // null means broadcast to all
  course_id: z.string().uuid().nullable().optional(), // if specified, broadcast to enrolled students
  title: z.string().min(1, 'Title is required'),
  title_ar: z.string().default(''),
  body: z.string().min(1, 'Body is required'),
  body_ar: z.string().default(''),
  type: z.enum([
    'exam_reminder',
    'exam_missed',
    'pdf_published',
    'exam_published',
    'result_available',
    'manual',
  ]).default('manual'),
});

module.exports = {
  sendNotificationSchema,
};
