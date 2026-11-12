import React from 'react';

/**
 * Accessible button following Vercel Geist design tokens.
 * - Marketing / high-emphasis actions: rounded-pill (100px)
 * - Nav / App controls: rounded-sm (6px)
 * - Minimum touch target: 44px (WCAG AAA)
 */
export function Button({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'sm' | 'ghost' | 'danger' | 'outline'
  size = 'md',        // 'sm' | 'md' | 'lg'
  className = '',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  icon: Icon,
  ...props
}) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all select-none touch-target focus-ring disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer gap-2';

  const variants = {
    // Vercel Geist primary pill
    primary:
      'bg-ink text-on-primary hover:bg-black active:scale-[0.98] rounded-pill px-5 text-sm shadow-xs',
    // Vercel Geist secondary pill
    secondary:
      'bg-elevated text-ink border border-hairline hover:bg-hairline-soft active:scale-[0.98] rounded-pill px-5 text-sm',
    // Tight 6px square app control
    sm:
      'bg-ink text-on-primary hover:bg-black rounded-sm px-3 text-xs',
    ghost:
      'bg-transparent text-ink hover:bg-hairline-soft border border-transparent rounded-sm px-3 text-xs',
    outline:
      'bg-elevated text-ink border border-hairline hover:bg-hairline-soft rounded-sm px-3 text-xs',
    danger:
      'bg-error text-white hover:bg-error-deep rounded-sm px-3 text-xs shadow-xs',
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {Icon && (
        <Icon
          className={`w-4 h-4 shrink-0 ${loading ? 'animate-spin' : ''}`}
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </button>
  );
}

