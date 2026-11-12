import React from 'react';

export function Badge({
  children,
  variant = 'neutral', // 'neutral' | 'error' | 'warning' | 'success' | 'info' | 'violet'
  size = 'md',
  className = '',
  icon: Icon,
}) {
  const variants = {
    neutral: 'bg-hairline-soft text-body border-hairline',
    error: 'bg-error-soft text-error-deep border-error/20 font-medium',
    warning: 'bg-warning-soft text-warning-deep border-warning/30 font-medium',
    success: 'bg-success-soft text-success-deep border-success/30 font-medium',
    info: 'bg-link-soft text-link-deep border-link/30 font-medium',
    violet: 'bg-violet-soft text-violet border-violet/30 font-medium',
  };

  const sizes = {
    sm: 'text-[11px] px-1.5 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border ${variants[variant] || variants.neutral} ${sizes[size] || sizes.md} ${className}`}
    >
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
      <span>{children}</span>
    </span>
  );
}

