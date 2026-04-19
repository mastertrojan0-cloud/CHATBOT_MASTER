import { createRouter, RootRoute, Route } from '@tanstack/react-router';
import { Layout } from '@/layout/Layout';
import DashboardPage from '@/pages/DashboardPage';
import LeadsPage from '@/pages/LeadsPage';
import ConnectPage from '@/pages/ConnectPage';
import SettingsPage from '@/pages/SettingsPage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';

const rootRoute = new RootRoute({
  component: ({ children }) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
      const path = typeof window !== 'undefined' ? window.location.pathname : '';
      const isAuthPage = path === '/login' || path === '/register';
      
      if (!token && !isAuthPage && typeof window !== 'undefined') {
        window.location.href = '/login';
        return null;
      }
      
      if (token && isAuthPage && typeof window !== 'undefined') {
        window.location.href = '/';
        return null;
      }
      
      return token ? <Layout>{children}</Layout> : <>{children}</>;
    } catch {
      return <>{children}</>;
    }
  },
});

const dashboardRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
});

const leadsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/leads',
  component: LeadsPage,
});

const connectRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/connect',
  component: ConnectPage,
});

const settingsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
});

const loginRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const registerRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/register',
  component: RegisterPage,
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  leadsRoute,
  connectRoute,
  settingsRoute,
  loginRoute,
  registerRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
