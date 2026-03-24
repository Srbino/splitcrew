import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Compass size={40} className="text-primary" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">404</h1>
        <h2 className="text-lg font-semibold text-muted-foreground mb-4">
          Off the charts!
        </h2>
        <p className="text-sm text-muted-foreground mb-8">
          This page doesn&apos;t exist. Maybe the wind took it somewhere else.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm no-underline hover:opacity-90 transition-opacity"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
