"use client";

import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { BusinessProviderWrapper } from "@/components/providers/BusinessProviderWrapper";

function AnalyticsContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
        <p className="text-muted-foreground">
          View detailed insights and performance metrics.
        </p>
      </div>
      
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
        <p className="text-muted-foreground">Analytics dashboard coming soon...</p>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <BusinessProviderWrapper>
      <DashboardLayout>
        <AnalyticsContent />
      </DashboardLayout>
    </BusinessProviderWrapper>
  );
}
