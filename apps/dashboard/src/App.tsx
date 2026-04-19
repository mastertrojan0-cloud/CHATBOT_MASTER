import React from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { router } from '@/config/router';
import { queryClient } from '@/config/queryClient';
import { Toaster } from 'sonner';
import { useAuthInit } from '@/hooks';
import '@/index.css';

function Root() {
  useAuthInit();

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster
        theme="dark"
        position="bottom-right"
        expand
        richColors
      />
    </QueryClientProvider>
  );
}

export default Root;