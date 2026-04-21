import React, { useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

function inferAutoComplete(
  props: React.InputHTMLAttributes<HTMLInputElement>,
  inputName: string
): string | undefined {
  if (props.autoComplete) {
    return props.autoComplete;
  }

  const name = inputName.toLowerCase();
  const type = (props.type || 'text').toLowerCase();

  if (name.includes('password')) return 'current-password';
  if (type === 'email' || name.includes('email')) return 'email';
  if (type === 'tel' || name.includes('phone') || name.includes('telefone')) return 'tel';
  if (type === 'url' || name.includes('website') || name.includes('site')) return 'url';
  if (name.includes('business') || name.includes('company') || name.includes('organization')) return 'organization';
  if (name === 'name' || name.includes('fullname') || name.includes('full-name')) return 'name';

  return undefined;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', ...props }, ref) => {
    const generatedId = useId();
    const inputId = props.id || generatedId;
    const inputName = props.name || inputId;
    const autoComplete = inferAutoComplete(props, inputName);

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
          autoComplete={autoComplete}
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
