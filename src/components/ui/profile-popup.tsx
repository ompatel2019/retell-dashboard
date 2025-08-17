"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { LogOut, Mail, Calendar } from "lucide-react";

interface ProfilePopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfilePopup({ open, onOpenChange }: ProfilePopupProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (open) {
      const getUser = async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUser(user);
        setLoading(false);
      };

      getUser();
    }
  }, [open, supabase.auth]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onOpenChange(false);
    router.push("/login");
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">Profile Information</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="md" className="text-muted-foreground" />
          </div>
        ) : !user ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Not authenticated</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* User Info */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg">
                  {user.email?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{user.email}</p>
                <p className="text-sm text-muted-foreground">
                  User ID: {user.id.slice(0, 8)}...
                </p>
              </div>
            </div>

            {/* User Details */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{user.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Member since:</span>
                <span className="font-medium">
                  {new Date(user.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Logout Button */}
            <Button
              onClick={handleLogout}
              className="w-full gap-2 bg-red-500 hover:bg-red-600 text-white cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
