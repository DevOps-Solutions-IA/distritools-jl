import * as React from 'react';
import { cn } from '@/lib/utils/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Input({
  id,
  label,
  error,
  helperText,
  className,
  disabled,
  ...props
}: InputProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;

  return (
    <div className="flex w-full flex-col gap-2">
      {label ? (
        <label htmlFor={inputId} className="text-sm font-semibold text-[var(--color-off-white)]">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error || helperText ? descriptionId : undefined}
        className={cn(
          'focus-ring h-11 rounded-md border bg-[var(--color-surface-muted)] px-3 text-sm text-[var(--color-off-white)] placeholder:text-[var(--color-text-secondary)] disabled:bg-[rgba(255,255,255,0.05)] disabled:text-[var(--color-text-secondary)]',
          error ? 'border-[var(--color-error-red)]' : 'border-[var(--color-border)]',
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={descriptionId} className="text-sm text-[var(--color-error-red)]">
          {error}
        </p>
      ) : helperText ? (
        <p id={descriptionId} className="text-sm text-[var(--color-text-secondary)]">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
