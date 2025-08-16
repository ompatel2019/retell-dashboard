"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { BusinessProviderWrapper } from "@/components/providers/BusinessProviderWrapper";
import { useBusinessContext } from "@/lib/user/BusinessContext";
import { Agent, PhoneNumber } from "@/lib/user/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function DashboardContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  // Use the business context
  const {
    businessData,
    loading: businessLoading,
    error: businessError,
    refetch,
  } = useBusinessContext();

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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground text-xl">Not authenticated</div>
      </div>
    );
  }

  // Show paused account screen when business exists but is paused
  if (!businessLoading && businessData?.business?.paused) {
    const reason = businessData.business.paused_reason;
    const until = businessData.business.paused_until
      ? new Date(businessData.business.paused_until).toLocaleString()
      : null;
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

        <div className="max-w-4xl mx-auto p-6">
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="text-yellow-900">Account Paused</CardTitle>
              <CardDescription className="text-yellow-800">
                This account is currently paused. Data and analytics are hidden.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reason && (
                  <p className="text-yellow-900">
                    <span className="font-medium">Reason:</span> {reason}
                  </p>
                )}
                {until && (
                  <p className="text-yellow-900">
                    <span className="font-medium">Paused until:</span> {until}
                  </p>
                )}
                <p className="text-yellow-900">
                  Please contact your Admin to resume access.
                </p>
                <div className="bg-white p-4 rounded-lg border border-yellow-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Contact Information:
                  </p>
                  <p className="text-lg font-semibold text-yellow-900">
                    +61490536019
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show no business data message when there's no business data
  if (!businessLoading && !businessData && businessError) {
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

        <div className="max-w-4xl mx-auto p-6">
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-800">
                No Business Data Found
              </CardTitle>
              <CardDescription className="text-red-600">
                Either you haven&apos;t paid this month&apos;s subscription, or
                there&apos;s an issue with your account setup.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-red-700">This usually happens when:</p>
                <ul className="list-disc list-inside text-red-700 space-y-1 ml-4">
                  <li>
                    Your account hasn&apos;t been properly set up with business
                    data
                  </li>
                  <li>Your subscription has expired</li>
                  <li>There&apos;s a technical issue with your account</li>
                </ul>
                <p className="text-red-700">
                  Please contact your Admin to resolve this issue.
                </p>
                <div className="bg-white p-4 rounded-lg border border-red-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Contact Information:
                  </p>
                  <p className="text-lg font-semibold text-red-800">
                    +61490536019
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
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
        {/* Welcome Section */}
        <div className="bg-card rounded-lg p-6 shadow-lg mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Welcome, {user?.email}!
          </h2>
          <p className="text-muted-foreground mb-4">
            You&apos;re successfully logged in to your dashboard.
          </p>

          {businessLoading ? (
            <div className="text-sm text-muted-foreground">
              Loading business information...
            </div>
          ) : businessError ? (
            <div className="text-sm text-red-600 mb-2">{businessError}</div>
          ) : businessData ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{businessData.business.name}</Badge>
              <Badge variant="outline">{businessData.membership.role}</Badge>
              <span className="text-sm text-muted-foreground">
                Timezone: {businessData.business.timezone}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No business information found. Please contact your administrator.
            </p>
          )}
        </div>

        {businessData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Business Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Business Overview</CardTitle>
                <CardDescription>Your company information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium">Name:</span>
                    <p className="text-sm text-muted-foreground">
                      {businessData.business.name}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Role:</span>
                    <p className="text-sm text-muted-foreground capitalize">
                      {businessData.membership.role}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Member Since:</span>
                    <p className="text-sm text-muted-foreground">
                      {new Date(
                        businessData.membership.created_at
                      ).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Agents */}
            <Card>
              <CardHeader>
                <CardTitle>AI Agents</CardTitle>
                <CardDescription>Your Retell AI agents</CardDescription>
              </CardHeader>
              <CardContent>
                {businessData.agents.length > 0 ? (
                  <div className="space-y-2">
                    {businessData.agents.map((agent: Agent) => (
                      <div key={agent.id} className="p-2 bg-muted rounded">
                        <p className="text-sm font-medium">
                          {agent.display_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {agent.retell_agent_id}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No agents configured
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Phone Numbers */}
            <Card>
              <CardHeader>
                <CardTitle>Phone Numbers</CardTitle>
                <CardDescription>Your business phone lines</CardDescription>
              </CardHeader>
              <CardContent>
                {businessData.phoneNumbers.length > 0 ? (
                  <div className="space-y-2">
                    {businessData.phoneNumbers.map((phone: PhoneNumber) => (
                      <div key={phone.id} className="p-2 bg-muted rounded">
                        <p className="text-sm font-medium">{phone.e164}</p>
                        <p className="text-xs text-muted-foreground">
                          Added{" "}
                          {new Date(phone.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No phone numbers configured
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <h4 className="font-medium text-foreground mb-2">
                  View Analytics
                </h4>
                <p className="text-sm text-muted-foreground">
                  Check your call data and insights
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <h4 className="font-medium text-foreground mb-2">
                  Manage Agents
                </h4>
                <p className="text-sm text-muted-foreground">
                  Configure your AI agents
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <h4 className="font-medium text-foreground mb-2">Settings</h4>
                <p className="text-sm text-muted-foreground">
                  Update business preferences
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <BusinessProviderWrapper>
      <DashboardContent />
    </BusinessProviderWrapper>
  );
}
