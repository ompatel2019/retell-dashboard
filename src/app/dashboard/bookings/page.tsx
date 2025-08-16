"use client";

import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { BusinessProviderWrapper } from "@/components/providers/BusinessProviderWrapper";

function BookingsContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Bookings</h2>
        <p className="text-muted-foreground">
          Manage your appointment bookings and scheduling.
        </p>
      </div>
      
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
        <p className="text-muted-foreground">Booking management features coming soon...</p>
      </div>
    </div>
  );
}

export default function BookingsPage() {
  return (
    <BusinessProviderWrapper>
      <DashboardLayout>
        <BookingsContent />
      </DashboardLayout>
    </BusinessProviderWrapper>
  );
}
