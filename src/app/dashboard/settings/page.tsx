"use client";

import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { BusinessProviderWrapper } from "@/components/providers/BusinessProviderWrapper";
import { ThemeSelector } from "@/components/ui/theme-selector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon, Palette, Bell, Shield } from "lucide-react";

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
            <CardDescription>Customize your dashboard appearance</CardDescription>
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

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>Manage your notification preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Notification settings coming soon...
            </p>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security
            </CardTitle>
            <CardDescription>Manage your account security</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Security settings coming soon...
            </p>
          </CardContent>
        </Card>

        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              General
            </CardTitle>
            <CardDescription>General dashboard settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              General settings coming soon...
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <BusinessProviderWrapper>
      <DashboardLayout>
        <SettingsContent />
      </DashboardLayout>
    </BusinessProviderWrapper>
  );
}
