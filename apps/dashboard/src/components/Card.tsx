import React from 'react';

interface CardProps {
  className?: string;
  elevated?: boolean;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ className = '', elevated, children }) => {
  return (
    <div className={`${elevated ? 'card-elevated' : 'card'} ${className}`}>
      {children}
    </div>
  );
};

interface CardHeaderProps {
  title?: string;
  subtitle?: string;
  className?: string;
  children?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  className = '',
  children,
}) => {
  return (
    <div className={`mb-md ${className}`}>
      {children ? (
        children
      ) : (
        <>
          {title && <h3 className="text-title-lg text-dark-100 font-display font-bold">{title}</h3>}
          {subtitle && <p className="text-body-sm text-dark-400 mt-xs">{subtitle}</p>}
        </>
      )}
    </div>
  );
};

interface CardBodyProps {
  className?: string;
  children: React.ReactNode;
}

export const CardBody: React.FC<CardBodyProps> = ({ className = '', children }) => {
  return <div className={`${className}`}>{children}</div>;
};

interface CardFooterProps {
  className?: string;
  children: React.ReactNode;
}

export const CardFooter: React.FC<CardFooterProps> = ({ className = '', children }) => {
  return <div className={`mt-lg pt-md border-t border-dark-700 ${className}`}>{children}</div>;
};

interface CardTitleProps {
  className?: string;
  children: React.ReactNode;
}

export const CardTitle: React.FC<CardTitleProps> = ({ className = '', children }) => {
  return <h3 className={`text-title-lg text-dark-100 font-display font-bold ${className}`}>{children}</h3>;
};
