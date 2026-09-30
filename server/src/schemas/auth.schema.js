const { z } = require('zod');

const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or Student ID is required'),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

module.exports = {
  loginSchema,
  changePasswordSchema,
};
