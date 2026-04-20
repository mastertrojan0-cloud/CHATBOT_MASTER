import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Smartphone,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useLogout } from '@/hooks/mutations';
import { Topbar } from './Topbar';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { tenant } = useAuthStore();
  const logoutMutation = useLogout();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'Leads', path: '/leads' },
    { icon: Smartphone, label: 'Conectar', path: '/connect' },
    { icon: Settings, label: 'Configurações', path: '/settings' },
  ];

  const usagePercentage = tenant
    ? (tenant.usage.leadsPerMonth / (tenant.usage.leadsPerMonthLimit || 1)) * 100
    : 0;
  const isNearLimit = usagePercentage >= 80;

  return (
    <div className="flex h-screen bg-dark-900">
      {/* Sidebar */}
      <aside
        className={`${
          isSidebarOpen ? 'w-64' : 'w-20'
        } bg-dark-800 border-r border-dark-700 transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="h-20 flex items-center justify-between px-md border-b border-dark-700">
          {isSidebarOpen && (
            <NavLink to="/dashboard" className="flex items-center gap-sm">
              <div className="w-10 h-10 bg-gradient-to-br from-brand-400 to-brand-600 rounded-lg flex items-center justify-center">
                <span className="font-display font-bold text-dark-900 text-lg">F</span>
              </div>
              <span className="font-display font-bold text-dark-100 text-title-lg">FlowDesk</span>
            </NavLink>
          )}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-xs hover:bg-dark-700 rounded-md transition-colors text-dark-400"
          >
            {isSidebarOpen ? <ChevronDown className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-md space-y-xs">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-md px-md py-sm rounded-md transition-colors ${
                  isActive
                    ? 'bg-brand-500/20 text-brand-400'
                    : 'text-dark-300 hover:text-brand-400 hover:bg-brand-500/10'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {isSidebarOpen && <span className="text-body-sm font-medium">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Usage Bar */}
        {isSidebarOpen && (
          <div className="p-md space-y-md border-t border-dark-700">
            {/* Usage */}
            <div className="space-y-xs">
              <div className="flex items-center justify-between">
                <span className="text-body-sm text-dark-400 font-medium">
                  {tenant?.plan === 'pro' ? 'Pro' : 'Free'}
                </span>
                <span className="text-body-sm text-dark-300">
                  {Math.round(usagePercentage)}%
                </span>
              </div>
              <div className="w-full bg-dark-700 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full ${isNearLimit ? 'bg-yellow-500' : 'bg-brand-500'}`}
                  style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                />
              </div>
              <p className="text-body-sm text-dark-400">
                {tenant?.usage.leadsPerMonth}/{tenant?.usage.leadsPerMonthLimit} leads
              </p>
            </div>

            {/* WAHA Status */}
            {tenant && (
              <div className="flex items-center gap-sm">
                <div
                  className={`w-2 h-2 rounded-full ${
                    tenant.waConnected ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                <span className="text-body-sm text-dark-300">
                  {tenant.waConnected ? 'WhatsApp Conectado' : 'Desconectado'}
                </span>
              </div>
            )}

            {/* Tenant Info */}
            {tenant && (
              <div className="text-body-sm space-y-xs">
                <p className="text-dark-300 font-medium truncate">{tenant.businessName}</p>
                <p className="text-dark-400 text-xs truncate">{tenant.name}</p>
              </div>
            )}

            {/* Logout */}
            <button
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="w-full flex items-center gap-md px-sm py-sm rounded-md text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-colors text-body-sm"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair</span>
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto bg-dark-900">
          {children}
        </main>
      </div>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="hidden max-md:flex fixed bottom-md right-md z-40 p-md bg-brand-600 text-white rounded-full shadow-lg hover:bg-brand-700"
      >
        {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>
    </div>
  );
};
