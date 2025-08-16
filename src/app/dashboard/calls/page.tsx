"use client";

import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { BusinessProviderWrapper } from "@/components/providers/BusinessProviderWrapper";

function CallsContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Calls</h2>
        <p className="text-muted-foreground">
          Manage and view your call history and recordings.
        </p>
      </div>
      
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
        <p className="text-muted-foreground">Call management features coming soon...</p>
      </div>
    </div>
  );
}

export default function CallsPage() {
  return (
    <BusinessProviderWrapper>
      <DashboardLayout>
        <CallsContent />
      </DashboardLayout>
    </BusinessProviderWrapper>
  );
}
