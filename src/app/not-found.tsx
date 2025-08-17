"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    // Auto-redirect to login after 5 seconds
    const timer = setTimeout(() => {
      router.push("/login");
    }, 5000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-4xl font-bold text-destructive">404</CardTitle>
          <h2 className="text-xl font-semibold">Page Not Found</h2>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <div className="space-y-2">
            <Button 
              onClick={() => router.push("/login")}
              className="w-full"
            >
              Go to Login
            </Button>
            <Button 
              variant="outline" 
              onClick={() => router.back()}
              className="w-full"
            >
              Go Back
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            You&apos;ll be automatically redirected to login in 5 seconds...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
