import { createRouter, RootRoute, Route, Outlet } from '@tanstack/react-router';
import { Layout } from '@/layout/Layout';
import DashboardPage from '@/pages/DashboardPage';
import LeadsPage from '@/pages/LeadsPage';
import ConnectPage from '@/pages/ConnectPage';
import SettingsPage from '@/pages/SettingsPage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';

const rootRoute = new RootRoute();

// Layout route for authenticated pages
const layoutRoute = new Route({
  getParentRoute: () => rootRoute,
  id: 'layout',
  component: () => <Layout><Outlet /></Layout>,
});

const dashboardRoute = new Route({
  getParentRoute: () => layoutRoute,
  path: '/',
  component: DashboardPage,
});

const leadsRoute = new Route({
  getParentRoute: () => layoutRoute,
  path: '/leads',
  component: LeadsPage,
});

const connectRoute = new Route({
  getParentRoute: () => layoutRoute,
  path: '/connect',
  component: ConnectPage,
});

const settingsRoute = new Route({
  getParentRoute: () => layoutRoute,
  path: '/settings',
  component: SettingsPage,
});

// Public routes (no layout)
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
  layoutRoute.addChildren([
    dashboardRoute,
    leadsRoute,
    connectRoute,
    settingsRoute,
  ]),
  loginRoute,
  registerRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
