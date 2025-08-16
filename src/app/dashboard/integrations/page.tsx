"use client";

import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { BusinessProviderWrapper } from "@/components/providers/BusinessProviderWrapper";

function IntegrationsContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Integrations</h2>
        <p className="text-muted-foreground">
          Connect with third-party services and tools.
        </p>
      </div>
      
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
        <p className="text-muted-foreground">Integration options coming soon...</p>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <BusinessProviderWrapper>
      <DashboardLayout>
        <IntegrationsContent />
      </DashboardLayout>
    </BusinessProviderWrapper>
  );
}
