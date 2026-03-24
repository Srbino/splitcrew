'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-6">
        <AlertCircle size={32} className="text-destructive" />
      </div>
      <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        An unexpected error occurred. Try refreshing the page or go back to the dashboard.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
          Dashboard
        </Button>
        <Button onClick={reset}>
          <RefreshCw size={14} className="mr-1.5" />
          Try again
        </Button>
      </div>
    </div>
  );
}
