"use client";

import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { ThemeSelector } from "@/components/ui/theme-selector";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Palette } from "lucide-react";

function SettingsContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your account and business preferences.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>
              Customize your dashboard appearance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-start">
              <ThemeSelector />
            </div>
            <p className="text-sm text-muted-foreground">
              Switch between light, dark, and system themes for your dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <SettingsContent />
    </DashboardLayout>
  );
}
