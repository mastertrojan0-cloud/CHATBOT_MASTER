import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/config/queryClient'
import { Toaster } from 'sonner'
import LoginPage from '@/pages/LoginPage'
import '@/index.css'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LoginPage />
      <Toaster theme="dark" position="bottom-right" />
    </QueryClientProvider>
  )
}