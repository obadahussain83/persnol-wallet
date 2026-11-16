import { z } from 'zod';

// Messages are i18n keys under `errors.`.
const email = z.string().trim().email('invalidEmail');
const newPassword = z.string().min(8, 'passwordShort');

export const signInSchema = z.object({ email, password: z.string().min(1, 'required') });

export const newPasswordSchema = z
  .object({ password: newPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'passwordMismatch' });

export const signUpSchema = z
  .object({ email, password: newPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'passwordMismatch' });

export const emailOnlySchema = z.object({ email });
