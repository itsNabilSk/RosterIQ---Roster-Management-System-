import React from 'react';

export function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-elevated border border-hairline rounded-md p-4 sm:p-6 transition-all ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

