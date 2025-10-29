"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const shouldBlock = false;

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
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>

      {/* Blocking overlay when business is paused or missing */}
      <Dialog open={shouldBlock}>
        <DialogOverlay className="bg-black/50 backdrop-blur-[1px]" />
        <DialogContent
          showCloseButton={false}
          className="text-center max-w-lg p-8 md:p-10 rounded-xl"
        >
          <DialogTitle className="sr-only">Account Status</DialogTitle>
          <div className="space-y-6">
            <h2 className="text-2xl md:text-3xl font-semibold">
              Account requires attention
            </h2>
            <div className="text-left mx-auto max-w-3xl">
              <ul className="list-none space-y-3 text-base md:text-lg text-muted-foreground">
                <li className="flex items-center">
                  <span className="mr-3 text-white font-bold text-2xl">•</span>
                  <span>Your account may be paused by an admin</span>
                </li>
                <li className="flex items-center">
                  <span className="mr-3 text-white font-bold text-2xl">•</span>
                  <span>Your business may be deleted or not yet created</span>
                </li>
                <li className="flex items-center">
                  <span className="mr-3 text-white font-bold text-2xl">•</span>
                  <span>
                    Possible reasons: paused subscription, overdue invoices, or
                    setup pending
                  </span>
                </li>
              </ul>
            </div>
            <div className="pt-2">
              <a href="tel:+61490536019" className="inline-block">
                <Button size="lg" className="px-6">
                  <Phone className="mr-2" /> Call +61 490 536 019
                </Button>
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
