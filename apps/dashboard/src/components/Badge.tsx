import React from 'react';

interface BadgeProps {
  variant?: 'brand' | 'success' | 'warning' | 'error' | 'neutral';
  className?: string;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', className = '', children }) => {
  const variantClasses = {
    brand: 'badge-brand',
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    neutral: 'badge-neutral',
  };

  return <span className={`${variantClasses[variant]} ${className}`}>{children}</span>;
};
