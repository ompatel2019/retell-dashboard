"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Phone,
  Calendar,
  BarChart3,
  Settings,
  User,
  Plug,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";

interface SidebarProps {
  className?: string;
  collapsed: boolean;
  onToggle: () => void;
}

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Calls",
    href: "/dashboard/calls",
    icon: Phone,
  },
  {
    name: "Bookings",
    href: "/dashboard/bookings",
    icon: Calendar,
  },
  {
    name: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
  },
  {
    name: "Integrations",
    href: "/dashboard/integrations",
    icon: Plug,
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

export function Sidebar({ className, collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        "flex flex-col border-r bg-background transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64",
        className
      )}
    >
      <div className="flex h-16 items-center justify-between p-4 border-b">
        <h1
          className={cn(
            "font-semibold transition-all duration-200",
            collapsed ? "hidden" : "block"
          )}
        >
          Byt.
        </h1>

        {/* Toggle Button - positioned in top-right of sidebar */}
        <button
          onClick={onToggle}
          className="h-6 w-6 rounded-md text-white hover:text-white hover:bg-accent transition-all duration-200 flex items-center justify-center shrink-0"
        >
          {collapsed ? (
            <PanelRightClose className="size-4" />
          ) : (
            <PanelRightOpen className="size-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-2 p-2">
        {navigation.map((item, index) => {
          const isActive = pathname === item.href;
          return (
            <div key={item.name}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground",
                  collapsed && "justify-center px-2"
                )}
              >
                <item.icon className="size-4" />
                {!collapsed && <span>{item.name}</span>}
              </Link>
              {index < navigation.length - 1 && collapsed && (
                <div className="mx-3 my-2" />
              )}
            </div>
          );
        })}
      </nav>

      {/* Profile Section at Bottom */}
      <div className="border-t p-2">
        <Link
          href="/dashboard/profile"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground text-muted-foreground",
            collapsed && "justify-center px-2"
          )}
        >
          <User className="size-4" />
          {!collapsed && <span>Profile</span>}
        </Link>
      </div>
    </div>
  );
}
