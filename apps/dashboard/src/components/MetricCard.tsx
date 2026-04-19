import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  delta,
  icon,
  className = '',
}) => {
  return (
    <div className={`metric-card ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="metric-label">{label}</p>
          <p className="metric-value mt-md">{value}</p>
        </div>
        {icon && <div className="text-brand-500">{icon}</div>}
      </div>

      {delta && (
        <div className="flex items-center gap-xs">
          {delta.isPositive ? (
            <TrendingUp className="w-4 h-4 text-green-400" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-400" />
          )}
          <span className={`metric-delta ${delta.isPositive ? 'metric-delta-up' : 'metric-delta-down'}`}>
            {delta.isPositive ? '+' : '-'}
            {Math.abs(delta.value)}%
          </span>
          <span className="text-dark-400 text-body-sm">vs. período anterior</span>
        </div>
      )}
    </div>
  );
};
