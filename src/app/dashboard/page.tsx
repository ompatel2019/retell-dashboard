"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    getUser();
  }, [supabase.auth]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card p-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors duration-200"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-card rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Welcome, {user?.email}!
          </h2>
          <p className="text-muted-foreground mb-6">
            You&apos;re successfully logged in to your dashboard.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-background p-4 rounded-lg border border-border">
              <h3 className="text-lg font-medium text-foreground mb-2">Profile</h3>
              <p className="text-muted-foreground text-sm">Manage your account settings</p>
            </div>
            
            <div className="bg-background p-4 rounded-lg border border-border">
              <h3 className="text-lg font-medium text-foreground mb-2">Analytics</h3>
              <p className="text-muted-foreground text-sm">View your data insights</p>
            </div>
            
            <div className="bg-background p-4 rounded-lg border border-border">
              <h3 className="text-lg font-medium text-foreground mb-2">Settings</h3>
              <p className="text-muted-foreground text-sm">Configure your preferences</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}