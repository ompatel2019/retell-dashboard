"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { BusinessProviderWrapper } from "@/components/providers/BusinessProviderWrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, User as UserIcon, Mail, Calendar } from "lucide-react";

function ProfileContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Profile</h2>
          <p className="text-muted-foreground">Loading profile information...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Profile</h2>
          <p className="text-muted-foreground">Not authenticated</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Profile</h2>
        <p className="text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        {/* User Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              User Information
            </CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg">
                  {user.email?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{user.email}</p>
                <p className="text-sm text-muted-foreground">User ID: {user.id}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4" />
                <span className="text-muted-foreground">Email:</span>
                <span>{user.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4" />
                <span className="text-muted-foreground">Member since:</span>
                <span>{new Date(user.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle>Account Actions</CardTitle>
            <CardDescription>Manage your account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              onClick={handleLogout}
              className="w-full gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
            
            <div className="text-sm text-muted-foreground">
              <p>Click logout to sign out of your account and return to the login page.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <BusinessProviderWrapper>
      <DashboardLayout>
        <ProfileContent />
      </DashboardLayout>
    </BusinessProviderWrapper>
  );
}
