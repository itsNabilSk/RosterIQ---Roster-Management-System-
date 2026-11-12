import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import { RosterView } from './features/roster/RosterView.jsx';
import { EmployeesPage } from './features/crud/EmployeesPage.jsx';
import { PodsPage } from './features/crud/PodsPage.jsx';
import { BrandsPage } from './features/crud/BrandsPage.jsx';
import { ProcessesPage } from './features/crud/ProcessesPage.jsx';
import { AssignmentsPage } from './features/crud/AssignmentsPage.jsx';
import { LeavesPage } from './features/crud/LeavesPage.jsx';
import { HolidaysPage } from './features/crud/HolidaysPage.jsx';
import { DemoPage } from './features/demo/DemoPage.jsx';

function RouteChangeHandler() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Ensure body scroll lock is always released on navigation
    document.body.style.overflow = '';
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <RouteChangeHandler />
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<RosterView />} />
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="pods" element={<PodsPage />} />
            <Route path="brands" element={<BrandsPage />} />
            <Route path="processes" element={<ProcessesPage />} />
            <Route path="assignments" element={<AssignmentsPage />} />
            <Route path="leaves" element={<LeavesPage />} />
            <Route path="holidays" element={<HolidaysPage />} />
            <Route path="demo" element={<DemoPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
