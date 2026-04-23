import React from 'react';
import { Sidebar } from './Sidebar';
import { Container } from '@/src/components/ui/Container';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <header className="h-16 border-b bg-background/95 backdrop-blur px-8 flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-lg font-semibold">Dashboard</h2>
          <div className="flex items-center gap-4">
            {/* User Profile / Notifications */}
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-bold">JD</span>
            </div>
          </div>
        </header>
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
};
