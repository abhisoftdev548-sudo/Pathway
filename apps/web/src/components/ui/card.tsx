import { type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
export const Card = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={cn('rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,28,77,.05)]', className)} {...p} />;
export const CardHeader = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={cn('px-5 pt-5 pb-2', className)} {...p} />;
export const CardTitle = ({ className, ...p }: HTMLAttributes<HTMLHeadingElement>) => <h3 className={cn('text-base font-bold text-navy-950', className)} {...p} />;
export const CardContent = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={cn('px-5 pb-5 pt-2', className)} {...p} />;
