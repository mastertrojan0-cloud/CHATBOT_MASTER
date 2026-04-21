import React, { useId } from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string | number; label: string }>;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = '', ...props }, ref) => {
    const generatedId = useId();
    const selectId = props.id || generatedId;
    const selectName = props.name || selectId;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-body-sm font-medium text-dark-300 mb-xs">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          name={selectName}
          className={`input ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/50' : ''} ${className}`}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <p className="text-body-sm text-red-400 mt-xs">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
