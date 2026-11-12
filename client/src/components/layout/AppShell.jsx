import React from 'react';
import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar.jsx';
import { Sidebar } from './Sidebar.jsx';
import { MobileNav } from './MobileNav.jsx';

export function AppShell() {
  return (
    <div className="min-h-dvh bg-canvas text-ink flex flex-col font-sans antialiased">
      <TopBar />

      <div className="flex-1 flex max-w-[1600px] w-full mx-auto">
        <Sidebar />

        {/* Main Content Area */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto pb-24 md:pb-8">
          <Outlet />
        </main>
      </div>

      <MobileNav />
    </div>
  );
}

