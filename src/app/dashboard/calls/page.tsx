"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { BusinessProviderWrapper } from "@/components/providers/BusinessProviderWrapper";
import { createClient } from "@/lib/supabase/client";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  disconnection_reason?: string | null;
};

function CallsContent() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [direction, setDirection] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  useEffect(() => {
    async function fetchCalls() {
      try {
        let query = supabase
          .from('calls')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(100);
        if (status !== 'all') query = query.eq('status', status);
        if (direction !== 'all') query = query.eq('direction', direction);
        if (startDate) query = query.gte('started_at', new Date(startDate).toISOString());
        if (endDate) {
          const end = new Date(endDate); end.setHours(23,59,59,999);
          query = query.lte('started_at', end.toISOString());
        }
        if (q.trim().length > 0) {
          const searchTerm = q.trim();
          // Create a normalized search term that removes + and country code
          let normalizedSearch = searchTerm;
          if (searchTerm.startsWith('+61')) {
            normalizedSearch = searchTerm.substring(3); // Remove +61
          } else if (searchTerm.startsWith('+')) {
            normalizedSearch = searchTerm.substring(1); // Remove +
          }
          
          // Search for both the original term and normalized version
          query = query.or(`from_number.ilike.%${searchTerm}%,to_number.ilike.%${searchTerm}%,from_number.ilike.%${normalizedSearch}%,to_number.ilike.%${normalizedSearch}%`);
        }
        const { data, error } = await query;

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
  }, [supabase, status, direction, startDate, endDate, q]);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('calls')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(100);
        if (status !== 'all') query = query.eq('status', status);
        if (direction !== 'all') query = query.eq('direction', direction);
        if (startDate) query = query.gte('started_at', new Date(startDate).toISOString());
        if (endDate) { const end = new Date(endDate); end.setHours(23,59,59,999); query = query.lte('started_at', end.toISOString()); }
        if (q.trim().length > 0) {
          const searchTerm = q.trim();
          // Create a normalized search term that removes + and country code
          let normalizedSearch = searchTerm;
          if (searchTerm.startsWith('+61')) {
            normalizedSearch = searchTerm.substring(3); // Remove +61
          } else if (searchTerm.startsWith('+')) {
            normalizedSearch = searchTerm.substring(1); // Remove +
          }
          
          // Search for both the original term and normalized version
          query = query.or(`from_number.ilike.%${searchTerm}%,to_number.ilike.%${searchTerm}%,from_number.ilike.%${normalizedSearch}%,to_number.ilike.%${normalizedSearch}%`);
        }
        const { data, error } = await query;
        if (!error) setCalls(data || []);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, status, direction, startDate, endDate, supabase]);

  const resetFilters = () => { setQ(""); setStatus("all"); setDirection("all"); setStartDate(""); setEndDate(""); };

  function formatDuration(seconds: number | null): string {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    return d.toLocaleDateString();
  }

  function formatTime(dateString: string | null): string {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // removed old badge helper to keep component lean

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Calls</h2>
        <p className="text-muted-foreground">
          View your call history and recordings from Retell.
        </p>
      </div>
      
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3 rounded-lg">
          <Input placeholder="Search number..." value={q} onChange={(e) => setQ(e.target.value)} className="w-40 md:w-52 border border-white/50" />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36 border-white/50"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="missed">Missed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={direction} onValueChange={setDirection}>
            <SelectTrigger className="w-36 border-white/50"><SelectValue placeholder="Direction" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All directions</SelectItem>
              <SelectItem value="inbound">Inbound</SelectItem>
              <SelectItem value="outbound">Outbound</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40 border border-white/50" />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40 border border-white/50" />
          <Button variant="default" onClick={resetFilters} className="">Reset</Button>
        </div>

        {loading ? (
          <div className="bg-card rounded-lg p-6">
            <p className="text-muted-foreground">Loading calls...</p>
          </div>
        ) : calls.length === 0 ? (
          <div className="bg-card rounded-lg p-6">
            <p className="text-muted-foreground">
              {q || status !== 'all' || direction !== 'all' || startDate || endDate 
                ? 'No calls match your current filters. Try adjusting your search criteria.' 
                : 'No calls found. Make a call to your Retell number to see data here.'}
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-lg overflow-hidden">
            {/* Header Row */}
            <div className="grid grid-cols-7 bg-muted h-11 items-center">
              <div className="px-3 font-medium">Session ID</div>
              <div className="px-3 font-medium">Date</div>
              <div className="px-3 font-medium">Time</div>
              <div className="px-3 font-medium">From</div>
              <div className="px-3 font-medium">Status</div>
              <div className="px-3 font-medium">Duration</div>
              <div className="px-3 font-medium">Actions</div>
            </div>
            
            {/* Data Rows */}
            {calls.map((call) => (
              <div
                key={call.id}
                className="grid grid-cols-7 h-14 cursor-pointer hover:bg-accent/20 border-b bg-[#2a2a2a] items-center"
                onClick={() => router.push(`/dashboard/calls/${encodeURIComponent(call.id)}`)}
              >
                <div className="px-3 font-mono text-xs md:text-sm truncate max-w-[200px]">{call.id}</div>
                <div className="px-3">{formatDate(call.started_at)}</div>
                <div className="px-3">{formatTime(call.started_at)}</div>
                <div className="px-3 truncate max-w-[180px]">{call.from_number || 'N/A'}</div>
                <div className="px-3 capitalize">{call.status ?? '-'}</div>
                <div className="px-3">{formatDuration(call.duration_seconds)}</div>
                <div className="px-3" onClick={(e) => e.stopPropagation()}>
                  <Link href={`/dashboard/calls/${encodeURIComponent(call.id)}`}>
                    <Button size="lg" variant="default" className="h-8 rounded-md px-3 cursor-pointer">View details</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
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
