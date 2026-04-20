import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/config/queryClient'
import { Toaster } from 'sonner'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import DashboardPage from '@/pages/DashboardPage'
import LeadsPage from '@/pages/LeadsPage'
import ConnectPage from '@/pages/ConnectPage'
import SettingsPage from '@/pages/SettingsPage'
import Sidebar from '@/components/Sidebar'
import '@/index.css'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = sessionStorage.getItem('flowdesk_access')
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PrivateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-dark-900">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<PrivateRoute><PrivateLayout><DashboardPage /></PrivateLayout></PrivateRoute>} />
          <Route path="/leads" element={<PrivateRoute><PrivateLayout><LeadsPage /></PrivateLayout></PrivateRoute>} />
          <Route path="/connect" element={<PrivateRoute><PrivateLayout><ConnectPage /></PrivateLayout></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><PrivateLayout><SettingsPage /></PrivateLayout></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster theme="dark" position="bottom-right" richColors />
    </QueryClientProvider>
  )
}

export default App