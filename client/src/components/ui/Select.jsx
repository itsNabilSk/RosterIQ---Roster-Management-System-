import React, { useId } from 'react';

export function Select({
  label,
  options = [],
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
      <select
        id={id}
        required={required}
        aria-invalid={Boolean(error)}
        className={`touch-target px-3 py-2 bg-elevated text-ink border border-hairline rounded-sm text-sm focus-ring transition-colors w-full cursor-pointer disabled:bg-hairline-soft ${
          error ? 'border-error' : 'hover:border-mute focus:border-ink'
        } ${className}`}
        {...props}
      >
        {options.map((opt) => {
          const value = typeof opt === 'object' ? opt.value : opt;
          const label = typeof opt === 'object' ? opt.label : opt;
          return (
            <option key={value} value={value}>
              {label}
            </option>
          );
        })}
      </select>
      {error && (
        <p className="text-xs text-error" role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p className="text-xs text-mute">
          {helperText}
        </p>
      )}
    </div>
  );
}

