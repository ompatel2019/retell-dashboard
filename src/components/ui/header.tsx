"use client";

import { ThemeToggle } from "./theme-toggle";

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  return (
    <header className={`h-16 border-b bg-background px-6 flex items-center justify-between ${className}`}>
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">Dashboard</h1>
      </div>
      
      <div className="flex items-center gap-4">
        <ThemeToggle />
      </div>
    </header>
  );
}
