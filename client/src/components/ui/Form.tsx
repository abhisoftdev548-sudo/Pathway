import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface FieldShellProps {
  label?: ReactNode;
  error?: string | null;
  hint?: ReactNode;
  required?: boolean;
  children: (id: string) => ReactNode;
}

export function Field({ label, error, hint, required, children }: FieldShellProps) {
  const id = useId();
  return (
    <div>
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}
      {children(id)}
      {hint && !error && <p className="mt-1 text-xs text-body">{hint}</p>}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; error?: string | null; hint?: ReactNode }>(
  function Input({ label, error, hint, required, className, id, ...rest }, ref) {
    return (
      <Field label={label} error={error} hint={hint} required={required}>
        {(fieldId) => (
          <input
            ref={ref}
            id={id ?? fieldId}
            className={cn('field-input', error && 'border-danger focus:border-danger focus:ring-danger', className)}
            aria-invalid={Boolean(error)}
            {...rest}
          />
        )}
      </Field>
    );
  }
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: ReactNode; error?: string | null; hint?: ReactNode }
>(function Textarea({ label, error, hint, required, className, id, ...rest }, ref) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      {(fieldId) => (
        <textarea
          ref={ref}
          id={id ?? fieldId}
          className={cn('field-input min-h-[88px]', error && 'border-danger', className)}
          aria-invalid={Boolean(error)}
          {...rest}
        />
      )}
    </Field>
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { label?: ReactNode; error?: string | null; hint?: ReactNode }
>(function Select({ label, error, hint, required, className, id, children, ...rest }, ref) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      {(fieldId) => (
        <select
          ref={ref}
          id={id ?? fieldId}
          className={cn('field-input appearance-none pr-8', error && 'border-danger', className)}
          aria-invalid={Boolean(error)}
          {...rest}
        >
          {children}
        </select>
      )}
    </Field>
  );
});

export function Checkbox({
  label,
  description,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-line-strong text-brand-600 focus:ring-brand-500"
        {...rest}
      />
      <div>
        <label htmlFor={id} className="text-sm font-medium text-body">
          {label}
        </label>
        {description && <p className="text-xs text-body">{description}</p>}
      </div>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-body">
          {label}
        </label>
        {description && <p className="text-xs text-body">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-brand-600' : 'bg-line-strong',
          disabled && 'opacity-50'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );
}
