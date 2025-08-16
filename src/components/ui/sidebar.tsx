"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Phone, 
  Calendar, 
  BarChart3, 
  Settings, 
  ChevronLeft,
  Menu,
  User,
  Plug
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
    <div className={cn(
      "flex flex-col border-r bg-background transition-all duration-300 ease-in-out",
      collapsed ? "w-16" : "w-64",
      className
    )}>
      <div className="flex h-16 items-center justify-between px-4 border-b">
        <h1 className={cn(
          "font-semibold transition-all duration-200",
          collapsed ? "hidden" : "block"
        )}>
          Byt.
        </h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="h-8 w-8 p-0"
        >
          {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
      
      <nav className="flex-1 space-y-1 p-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                collapsed && "justify-center px-2"
              )}
            >
              <item.icon className="h-4 w-4" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
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
          <User className="h-4 w-4" />
          {!collapsed && <span>Profile</span>}
        </Link>
      </div>
    </div>
  );
}
