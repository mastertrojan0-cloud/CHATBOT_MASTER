import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-body-sm font-medium text-dark-300 mb-xs">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`input ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/50' : ''} ${className}`}
          {...props}
        />
        {error && <p className="text-body-sm text-red-400 mt-xs">{error}</p>}
        {helperText && !error && <p className="text-body-sm text-dark-400 mt-xs">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
