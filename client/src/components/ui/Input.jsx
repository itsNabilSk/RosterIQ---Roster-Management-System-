import React, { useId } from 'react';

export function Input({
  label,
  error,
  helperText,
  id: customId,
  className = '',
  required = false,
  ...props
}) {
  const generatedId = useId();
  const id = customId || generatedId;

  return (
    <div className="flex flex-col gap-1.5 w-full text-left">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-body flex items-center gap-1">
          {label}
          {required && <span className="text-error" aria-hidden="true">*</span>}
        </label>
      )}
      <input
        id={id}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
        className={`touch-target px-3 py-2 bg-elevated text-ink border border-hairline rounded-sm text-sm focus-ring placeholder:text-faint transition-colors w-full disabled:bg-hairline-soft disabled:cursor-not-allowed ${
          error ? 'border-error focus:ring-error' : 'hover:border-mute focus:border-ink'
        } ${className}`}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="text-xs text-error" role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={`${id}-helper`} className="text-xs text-mute">
          {helperText}
        </p>
      )}
    </div>
  );
}

