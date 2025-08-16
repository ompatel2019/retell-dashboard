"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { Button } from "./button";
import { Menu } from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar 
        className="flex-shrink-0"
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* Hamburger Menu Button when sidebar is collapsed */}
      {sidebarCollapsed && (
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="fixed top-4 left-4 z-50 h-10 w-10 p-0 bg-background border shadow-lg"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
