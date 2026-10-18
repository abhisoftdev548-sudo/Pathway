import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface FieldShellProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, error, required, htmlFor, children, className }: FieldShellProps) {
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="hint text-red-600">{error}</p>
      ) : hint ? (
        <p className="hint">{hint}</p>
      ) : null}
    </div>
  );
}

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { label, hint, error, className, wrapperClassName, required, id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId} className={wrapperClassName}>
      <input
        ref={ref}
        id={inputId}
        className={cn('input', error && 'input-invalid', className)}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
    </Field>
  );
});

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, hint, error, className, wrapperClassName, required, id, rows = 4, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId} className={wrapperClassName}>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        className={cn('input resize-y', error && 'input-invalid', className)}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
    </Field>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: { value: string; label: string }[];
  wrapperClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, options, className, wrapperClassName, required, id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId} className={wrapperClassName}>
      <select
        ref={ref}
        id={inputId}
        className={cn('input appearance-none bg-[length:16px] pr-8', error && 'input-invalid', className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23767c8a' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center',
        }}
        aria-invalid={error ? true : undefined}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
});

export interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, hint, disabled }: SwitchProps) {
  return (
    <label className={cn('flex items-start gap-2.5', disabled ? 'opacity-60' : 'cursor-pointer')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors',
          checked ? 'border-brand-600 bg-brand-600' : 'border-line-strong bg-line',
        )}
      >
        <span
          className={cn(
            'inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-[3px]',
          )}
        />
      </button>
      <span className="min-w-0">
        {label && <span className="block text-[13px] font-medium text-ink">{label}</span>}
        {hint && <span className="block text-xs text-ink-muted">{hint}</span>}
      </span>
    </label>
  );
}
