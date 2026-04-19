import React from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';

interface AlertProps {
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  onClose?: () => void;
}

export const Alert: React.FC<AlertProps> = ({
  type = 'info',
  title,
  message,
  onClose,
}) => {
  const typeStyles = {
    info: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
    success: 'bg-green-500/20 border-green-500/50 text-green-300',
    warning: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
    error: 'bg-red-500/20 border-red-500/50 text-red-300',
  };

  const IconComponent = type === 'warning' ? AlertTriangle : AlertCircle;

  return (
    <div className={`card border p-md flex items-start gap-md ${typeStyles[type]}`}>
      <IconComponent className="w-5 h-5 flex-shrink-0 mt-xs" />
      <div className="flex-1">
        {title && <h4 className="font-semibold text-body-md">{title}</h4>}
        <p className="text-body-sm">{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-dark-400 hover:text-dark-200 transition-colors"
        >
          ✕
        </button>
      )}
    </div>
  );
};
