import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, MessageSquare, Settings, LogOut } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

const navItems = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Leads', to: '/leads', icon: Users },
  { label: 'WhatsApp', to: '/connect', icon: MessageSquare },
  { label: 'Configurações', to: '/settings', icon: Settings },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const tenant = useAuthStore((state) => state.tenant)

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="hidden md:flex md:w-64 shrink-0 flex-col border-r border-dark-700 bg-dark-800">
      <div className="h-20 border-b border-dark-700 px-lg flex items-center">
        <NavLink to="/dashboard" className="flex items-center gap-sm">
          <div className="w-10 h-10 bg-gradient-to-br from-brand-400 to-brand-600 rounded-lg flex items-center justify-center">
            <span className="font-display font-bold text-dark-900 text-lg">F</span>
          </div>
          <div>
            <p className="font-display font-bold text-dark-100 text-title-md">FlowDesk</p>
            <p className="text-body-sm text-dark-400 truncate max-w-[150px]">
              {tenant?.businessName || 'Painel'}
            </p>
          </div>
        </NavLink>
      </div>

      <nav className="flex-1 p-md space-y-xs">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-sm rounded-md px-md py-sm text-body-md transition-colors ${
                  isActive
                    ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                    : 'text-dark-300 hover:bg-dark-700 hover:text-dark-100 border border-transparent'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t border-dark-700 p-md">
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="w-full flex items-center gap-sm rounded-md px-md py-sm text-body-md text-dark-300 hover:bg-red-500/10 hover:text-red-300 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}
