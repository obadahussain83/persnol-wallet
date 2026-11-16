import type { TextInputProps } from 'react-native';
import { type Control, Controller, type FieldValues, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ZodError } from 'zod';

import { DomainError } from '@/data/db';
import i18n from '@/i18n';

import { TextField } from './primitives';

/** Zod messages are i18n keys under `errors.`; anything unknown falls back to a generic message. */
export const translateError = (key?: string) =>
  key ? i18n.t(`errors.${key}`, { defaultValue: i18n.t('errors.invalid') }) : undefined;

/** User-facing message for a thrown error. */
export function errorMessage(e: unknown): string {
  if (e instanceof DomainError) return translateError(e.code)!;
  if (e instanceof ZodError) return translateError(e.issues[0]?.message)!;
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string' && 'status' in e) return e.message; // Supabase auth errors
  console.error(e);
  return i18n.t('errors.generic');
}

export function FormTextField<T extends FieldValues>({ control, name, label, ...rest }: {
  control: Control<T>; name: Path<T>; label: string;
} & Omit<TextInputProps, 'value' | 'onChangeText'>) {
  useTranslation(); // re-render on language change
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          label={label}
          value={field.value ?? ''}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={translateError(fieldState.error?.message)}
          {...rest}
        />
      )}
    />
  );
}
