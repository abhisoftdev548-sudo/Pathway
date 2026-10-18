import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Check, ChevronDown, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Button ──────────────────────────────────────────────────────────────── */

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-brand text-white shadow-sm hover:bg-brand-deep active:translate-y-px',
        secondary: 'bg-brand-soft text-brand-deep hover:bg-brand/15',
        outline: 'border border-line bg-surface text-ink hover:border-brand/30 hover:bg-brand-soft/40',
        ghost: 'text-ink/70 hover:bg-canvas hover:text-ink',
        subtle: 'bg-canvas text-ink/80 hover:bg-line/70',
        danger: 'bg-danger text-white hover:bg-danger/90',
        link: 'text-brand underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 rounded-lg px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-[15px]',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8 rounded-lg',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {children}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

/* ── Layout primitives ───────────────────────────────────────────────────── */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-2xl border border-line bg-surface shadow-card', className)}>{children}</div>;
}

export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('flex flex-col gap-1.5 p-5 sm:p-6', className)}>{children}</div>;
}

export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <h3 className={cn('text-base font-semibold tracking-tight text-ink', className)}>{children}</h3>;
}

export function CardDescription({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn('text-sm leading-relaxed text-muted', className)}>{children}</p>;
}

export function CardContent({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-5 pb-5 sm:px-6 sm:pb-6', className)}>{children}</div>;
}

export function CardFooter({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('flex items-center gap-2 border-t border-line/70 px-5 py-4 sm:px-6', className)}>{children}</div>;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="max-w-2xl">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h2 className="text-2xl font-semibold text-ink sm:text-[28px]">{title}</h2>
        {description ? <p className="mt-2 text-sm leading-relaxed text-muted sm:text-[15px]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* ── Form controls ───────────────────────────────────────────────────────── */

const fieldBase =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink shadow-sm transition placeholder:text-muted/60 focus:border-brand/50 focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  ({ className, invalid, ...props }, ref) => (
    <input ref={ref} className={cn(fieldBase, invalid && 'border-danger/60 focus:border-danger focus:ring-danger/10', className)} {...props} />
  ),
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(fieldBase, 'min-h-[96px] resize-y leading-relaxed', invalid && 'border-danger/60 focus:border-danger focus:ring-danger/10', className)}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select ref={ref} className={cn(fieldBase, 'appearance-none pr-9', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  ),
);
Select.displayName = 'Select';

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
          {label}
        </label>
        {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      </div>
      {children}
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}
    </div>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        {description ? <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p> : null}
      </div>
      <SwitchPrimitive.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={label}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full border border-transparent transition-colors',
          checked ? 'bg-brand' : 'bg-line',
          disabled && 'opacity-50',
        )}
      >
        <SwitchPrimitive.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[22px]" />
      </SwitchPrimitive.Root>
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  className,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  className?: string;
}) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-3 transition hover:bg-canvas/60', className)}>
      <span
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition',
          checked ? 'border-brand bg-brand text-white' : 'border-line bg-surface',
        )}
      >
        {checked ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </span>
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description ? <span className="mt-0.5 block text-xs leading-relaxed text-muted">{description}</span> : null}
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

/* ── Feedback ────────────────────────────────────────────────────────────── */

export function Badge({
  children,
  tone = 'bg-canvas text-ink/70 ring-line',
  className,
}: {
  children: ReactNode;
  tone?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
        tone,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  className,
  barClassName,
  label,
}: {
  value: number;
  className?: string;
  barClassName?: string;
  label?: string;
}) {
  const safe = Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-line/70', className)}
      role="progressbar"
      aria-valuenow={Math.round(safe)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Progress'}
    >
      <div
        className={cn('h-full rounded-full bg-brand transition-[width] duration-700 ease-out', barClassName)}
        style={{ width: `${safe}%` }}
      />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('relative overflow-hidden rounded-xl bg-line/60', className)} aria-hidden />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-14 text-center', className)}>
      {icon ? <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">{icon}</div> : null}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description ? <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const tones = {
    info: 'border-sky-200 bg-sky-50/70 text-sky-900',
    success: 'border-emerald-200 bg-emerald-50/70 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50/80 text-amber-900',
    danger: 'border-rose-200 bg-rose-50/80 text-rose-900',
  } as const;
  return (
    <div className={cn('rounded-xl border px-4 py-3 text-sm leading-relaxed', tones[tone], className)} role="status">
      {title ? <p className="font-semibold">{title}</p> : null}
      {children}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function Avatar({ name, src, size = 36 }: { name: string; src?: string; size?: number }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  if (src) {
    return <img src={src} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-deep text-xs font-semibold text-white"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {letters || 'P'}
    </span>
  );
}

/* ── Dialog ──────────────────────────────────────────────────────────────── */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  children,
  className,
  title,
  description,
  size = 'md',
}: {
  children: ReactNode;
  className?: string;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-lift focus:outline-none',
          widths[size],
          className,
        )}
      >
        <div className="mb-4 pr-8">
          <DialogPrimitive.Title className="text-lg font-semibold tracking-tight text-ink">{title}</DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="mt-1 text-sm leading-relaxed text-muted">
              {description}
            </DialogPrimitive.Description>
          ) : null}
        </div>
        <DialogPrimitive.Close
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted transition hover:bg-canvas hover:text-ink"
          aria-label="Close dialog"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}>{children}</div>;
}

/* ── Tabs ────────────────────────────────────────────────────────────────── */

export const Tabs = TabsPrimitive.Root;
export const TabsList = forwardRef<HTMLDivElement, TabsPrimitive.TabsListProps>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn('inline-flex items-center gap-1 rounded-xl border border-line bg-canvas/70 p-1', className)}
    {...props}
  />
));
TabsList.displayName = 'TabsList';

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsPrimitive.TabsTriggerProps>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'rounded-lg px-3 py-1.5 text-[13px] font-medium text-muted transition data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-sm',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = TabsPrimitive.Content;

/* ── Dropdown ────────────────────────────────────────────────────────────── */

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;

export function DropdownMenuContent({
  children,
  align = 'end',
  className,
}: {
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={6}
        className={cn(
          'z-50 min-w-[190px] overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-lift animate-pop-in',
          className,
        )}
      >
        {children}
      </DropdownPrimitive.Content>
    </DropdownPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  children,
  onSelect,
  className,
}: {
  children: ReactNode;
  onSelect?: () => void;
  className?: string;
}) {
  return (
    <DropdownPrimitive.Item
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink/80 outline-none transition data-[highlighted]:bg-canvas data-[highlighted]:text-ink',
        className,
      )}
    >
      {children}
    </DropdownPrimitive.Item>
  );
}

export function DropdownMenuSeparator() {
  return <DropdownPrimitive.Separator className="my-1 h-px bg-line" />;
}

/* ── Tooltip ─────────────────────────────────────────────────────────────── */

export function Tooltip({ children, content }: { children: ReactNode; content: string }) {
  return (
    <TooltipPrimitive.Provider delayDuration={250}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            sideOffset={6}
            className="z-50 max-w-xs rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-white shadow-lift"
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-ink" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
