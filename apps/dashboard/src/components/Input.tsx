import React, { useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', ...props }, ref) => {
    const generatedId = useId();
    const inputId = props.id || generatedId;
    const inputName = props.name || inputId;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-body-sm font-medium text-dark-300 mb-xs">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          name={inputName}
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
