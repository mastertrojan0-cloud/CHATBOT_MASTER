import React from 'react';

interface TableProps {
  className?: string;
  children: React.ReactNode;
}

export const Table: React.FC<TableProps> = ({ className = '', children }) => {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-body-sm ${className}`}>{children}</table>
    </div>
  );
};

interface TableHeaderProps {
  children: React.ReactNode;
}

export const TableHeader: React.FC<TableHeaderProps> = ({ children }) => {
  return (
    <thead className="border-b border-dark-700">
      <tr className="bg-dark-800/50">
        {children}
      </tr>
    </thead>
  );
};

interface TableBodyProps {
  children: React.ReactNode;
}

export const TableBody: React.FC<TableBodyProps> = ({ children }) => {
  return <tbody>{children}</tbody>;
};

interface TableRowProps {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

export const TableRow: React.FC<TableRowProps> = ({ className = '', children, onClick }) => {
  return (
    <tr
      className={`border-b border-dark-700 hover:bg-dark-800/50 transition-colors ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
};

interface TableHeadProps {
  className?: string;
  children: React.ReactNode;
  textAlign?: 'left' | 'center' | 'right';
}

export const TableHead: React.FC<TableHeadProps> = ({
  className = '',
  children,
  textAlign = 'left',
}) => {
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <th className={`px-md py-sm font-semibold text-dark-400 ${alignClasses[textAlign]} ${className}`}>
      {children}
    </th>
  );
};

interface TableCellProps {
  className?: string;
  children: React.ReactNode;
  textAlign?: 'left' | 'center' | 'right';
}

export const TableCell: React.FC<TableCellProps> = ({
  className = '',
  children,
  textAlign = 'left',
}) => {
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <td className={`px-md py-md text-dark-100 ${alignClasses[textAlign]} ${className}`}>
      {children}
    </td>
  );
};
