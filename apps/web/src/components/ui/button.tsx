import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
const variants = cva('inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 cursor-pointer', {
  variants: {
    variant: {
      default: 'brand-gradient text-white shadow-sm hover:opacity-95',
      secondary: 'bg-navy-950 text-white hover:bg-navy-800',
      outline: 'border border-slate-300 bg-white text-navy-950 hover:bg-slate-50',
      ghost: 'text-navy-900 hover:bg-slate-100',
      destructive: 'bg-red-600 text-white hover:bg-red-700',
      soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
    },
    size: { default: 'h-10 px-4', sm: 'h-8 px-3 text-xs', lg: 'h-12 px-6 text-base', icon: 'h-10 w-10' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> {}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...p }, ref) => (
  <button ref={ref} className={cn(variants({ variant, size }), className)} {...p} />
));
Button.displayName = 'Button';
