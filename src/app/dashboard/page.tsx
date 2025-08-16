"use client";

import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { BusinessProviderWrapper } from "@/components/providers/BusinessProviderWrapper";

function DashboardContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Welcome to your Retell dashboard. This is the main overview page.
        </p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Total Calls</h3>
          </div>
          <div className="text-2xl font-bold">0</div>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Active Agents</h3>
          </div>
          <div className="text-2xl font-bold">0</div>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Bookings</h3>
          </div>
          <div className="text-2xl font-bold">0</div>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Integrations</h3>
          </div>
          <div className="text-2xl font-bold">0</div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <BusinessProviderWrapper>
      <DashboardLayout>
        <DashboardContent />
      </DashboardLayout>
    </BusinessProviderWrapper>
  );
}
