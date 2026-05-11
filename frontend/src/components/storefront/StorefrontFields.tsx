import * as React from 'react';
import { cn } from '@/lib/utils/cn';

const fieldClassName =
  'focus-ring min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-base text-[var(--color-off-white)] placeholder:text-[var(--color-text-secondary)] disabled:bg-[rgba(255,255,255,0.05)] disabled:text-[var(--color-text-secondary)]';

interface FieldWrapperProps {
  id?: string;
  label?: string;
  error?: string;
  helperText?: string;
  children: (inputId: string, descriptionId: string) => React.ReactNode;
}

function FieldWrapper({ id, label, error, helperText, children }: FieldWrapperProps) {
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
      {children(inputId, descriptionId)}
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

interface StorefrontInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function StorefrontInput({
  id,
  label,
  error,
  helperText,
  className,
  ...props
}: StorefrontInputProps) {
  return (
    <FieldWrapper id={id} label={label} error={error} helperText={helperText}>
      {(inputId, descriptionId) => (
        <input
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error || helperText ? descriptionId : undefined}
          className={cn(fieldClassName, error && 'border-[var(--color-error-red)]', className)}
          {...props}
        />
      )}
    </FieldWrapper>
  );
}

export function StorefrontSearchInput(props: StorefrontInputProps) {
  return (
    <StorefrontInput
      type="search"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      autoCapitalize="none"
      inputMode="search"
      {...props}
    />
  );
}

interface StorefrontSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function StorefrontSelect({
  id,
  label,
  error,
  helperText,
  className,
  children,
  ...props
}: StorefrontSelectProps) {
  return (
    <FieldWrapper id={id} label={label} error={error} helperText={helperText}>
      {(inputId, descriptionId) => (
        <select
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error || helperText ? descriptionId : undefined}
          className={cn(fieldClassName, 'py-2', error && 'border-[var(--color-error-red)]', className)}
          {...props}
        >
          {children}
        </select>
      )}
    </FieldWrapper>
  );
}

interface StorefrontTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function StorefrontTextarea({
  id,
  label,
  error,
  helperText,
  className,
  ...props
}: StorefrontTextareaProps) {
  return (
    <FieldWrapper id={id} label={label} error={error} helperText={helperText}>
      {(inputId, descriptionId) => (
        <textarea
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error || helperText ? descriptionId : undefined}
          className={cn(fieldClassName, 'py-3', error && 'border-[var(--color-error-red)]', className)}
          {...props}
        />
      )}
    </FieldWrapper>
  );
}

interface StorefrontCheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: React.ReactNode;
}

export function StorefrontCheckbox({ label, className, ...props }: StorefrontCheckboxProps) {
  return (
    <label className="flex min-h-12 items-start gap-3 rounded-[1rem] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-3 py-2.5 text-sm leading-5 text-[var(--color-text-secondary)]">
      <input
        type="checkbox"
        style={{ fontSize: '16px' }}
        className={cn('mt-1 h-4 w-4 text-base accent-[var(--color-industrial-yellow)]', className)}
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}
