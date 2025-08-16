"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { BusinessProviderWrapper } from "@/components/providers/BusinessProviderWrapper";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Call = {
  id: string;
  from_number: string | null;
  to_number: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  status: string | null;
  summary: string | null;
  transcript: string | null;
  created_at: string;
};

function CallsContent() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchCalls() {
      try {
        const { data, error } = await supabase
          .from('calls')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('Error fetching calls:', error);
        } else {
          setCalls(data || []);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchCalls();

    // Set up real-time subscription
    const channel = supabase
      .channel('calls-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, () => {
        fetchCalls(); // Refresh data when calls table changes
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  function formatDuration(seconds: number | null): string {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  }

  function getStatusBadge(status: string | null) {
    if (!status) return <Badge variant="secondary">Unknown</Badge>;
    
    switch (status) {
      case 'active':
        return <Badge variant="default">Active</Badge>;
      case 'ended':
        return <Badge variant="secondary">Ended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Calls</h2>
        <p className="text-muted-foreground">
          View your call history and recordings from Retell.
        </p>
      </div>
      
      {loading ? (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <p className="text-muted-foreground">Loading calls...</p>
        </div>
      ) : calls.length === 0 ? (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <p className="text-muted-foreground">No calls found. Make a call to your Retell number to see data here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {calls.map((call) => (
            <Card key={call.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Call {call.id.slice(-8)}</CardTitle>
                  {getStatusBadge(call.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-muted-foreground">From:</span>
                    <p>{call.from_number || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">To:</span>
                    <p>{call.to_number || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Started:</span>
                    <p>{formatDate(call.started_at)}</p>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Duration:</span>
                    <p>{formatDuration(call.duration_seconds)}</p>
                  </div>
                </div>
                
                {call.summary && (
                  <div>
                    <span className="font-medium text-muted-foreground">Summary:</span>
                    <p className="mt-1">{call.summary}</p>
                  </div>
                )}
                
                {call.transcript && (
                  <div>
                    <span className="font-medium text-muted-foreground">Transcript:</span>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-3">{call.transcript}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
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
