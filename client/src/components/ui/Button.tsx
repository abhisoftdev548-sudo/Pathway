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
    'bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-700 disabled:bg-zinc-400',
  outline:
    'border border-gray-300 bg-white text-zinc-700 hover:bg-gray-50 active:bg-gray-100 disabled:text-zinc-400',
  ghost: 'text-zinc-600 hover:bg-gray-100 hover:text-zinc-900 disabled:text-zinc-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:bg-red-300',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-xs gap-1.5',
  md: 'h-9.5 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
};

/**
 * Primary interactive button with subtle press animation (respects reduced motion).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, icon, className, children, disabled, ...rest },
  ref
) {
  const reduceMotion = useReducedMotion();
  const motionProps: HTMLMotionProps<'button'> = reduceMotion
    ? {}
    : { whileTap: { scale: 0.97 }, whileHover: { y: -1 }, transition: { duration: 0.12 } };

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
