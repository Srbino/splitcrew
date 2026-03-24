'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  icon: React.ReactNode;
  iconBg?: string;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  className?: string;
}

export function StatCard({ icon, iconBg = 'bg-primary/10', label, value, detail, className }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
    >
      <Card className={cn('overflow-hidden', className)}>
        <CardContent className="p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className={cn('w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0', iconBg)}>
              {icon}
            </div>
            <span className="text-[13px] text-muted-foreground font-medium">{label}</span>
          </div>
          <div className="text-2xl font-bold tracking-tight">{value}</div>
          {detail && (
            <div className="text-xs text-muted-foreground mt-2">{detail}</div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
