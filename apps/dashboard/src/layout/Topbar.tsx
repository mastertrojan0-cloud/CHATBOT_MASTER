import React from 'react';
import { ArrowUpRight, Bell, User } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components';

export const Topbar: React.FC = () => {
  const { tenant } = useAuthStore();
  const usagePercentage = tenant
    ? (tenant.usage.leadsPerMonth / tenant.usage.leadsPerMonthLimit) * 100
    : 0;

  const isPro = tenant?.plan === 'pro';
  const isNearLimit = usagePercentage >= 80;

  return (
    <header className="h-20 bg-dark-800 border-b border-dark-700 px-lg flex items-center justify-between">
      <div>
        <h1 className="text-title-lg font-display font-bold text-dark-100">
          {tenant?.businessName}
        </h1>
        <p className="text-body-sm text-dark-400">Bem-vindo ao seu dashboard</p>
      </div>

      <div className="flex items-center gap-lg">
        {/* Usage Alert */}
        {isNearLimit && !isPro && (
          <div className="flex items-center gap-md px-md py-sm bg-yellow-500/20 border border-yellow-500/50 rounded-md">
            <span className="text-body-sm text-yellow-300 font-medium">
              {Math.round(usagePercentage)}% do seu limite atingido
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-xs text-yellow-300 hover:text-yellow-200"
            >
              Upgrade <ArrowUpRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-md">
          <button className="p-md rounded-md hover:bg-dark-700 transition-colors text-dark-400 hover:text-dark-100">
            <Bell className="w-5 h-5" />
          </button>
          <button className="p-md rounded-md hover:bg-dark-700 transition-colors text-dark-400 hover:text-dark-100">
            <User className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
