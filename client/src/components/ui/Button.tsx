import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300',
  secondary:
    'bg-heading text-white hover:bg-[#22304D] active:bg-[#0F182B] disabled:bg-muted',
  outline:
    'border border-line-strong bg-surface text-heading hover:bg-surface-muted active:bg-line disabled:text-muted',
  ghost: 'text-body hover:bg-surface-muted hover:text-heading disabled:text-muted',
  danger: 'bg-danger text-white hover:brightness-95 active:brightness-90 disabled:bg-danger/50',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-xs gap-1.5',
  md: 'h-9.5 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
};

/**
 * Primary interactive button with subtle press feedback (respects reduced motion).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, icon, className, children, disabled, ...rest },
  ref
) {
  const reduceMotion = useReducedMotion();
  const motionProps: HTMLMotionProps<'button'> = reduceMotion
    ? {}
    : { whileTap: { scale: 0.98 }, transition: { duration: 0.12 } };

  return (
    <motion.button
      ref={ref}
      {...motionProps}
      {...(rest as HTMLMotionProps<'button'>)}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        'disabled:cursor-not-allowed',
        variantClasses[variant],
        // md is the default height; h-9.5 is not in tailwind scale so compute:
        size === 'md' ? 'h-10 px-4 text-sm gap-2' : sizeClasses[size],
        className
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </motion.button>
  );
});

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-brand-600', className)} aria-hidden />;
}

export default Button;
