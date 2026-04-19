import React from 'react';
import { Outlet } from '@tanstack/react-router';
import { Layout } from '@/layout/Layout';

export default function App() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
