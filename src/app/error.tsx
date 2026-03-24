'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6">
        <AlertCircle size={32} className="text-red-500" />
      </div>
      <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
      <p className="text-sm text-gray-500 mb-6 max-w-md text-center">
        An unexpected error occurred. Please try again.
      </p>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm cursor-pointer border-none"
      >
        <RefreshCw size={14} />
        Try again
      </button>
    </div>
  );
}
