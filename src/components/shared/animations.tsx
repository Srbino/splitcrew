'use client';

import { motion, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Shared animation variants for consistent motion across the app.
 * Import these instead of defining per-page.
 */

// ── Container with staggered children ──
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

// ── Individual item (fade + slide up) ──
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', damping: 20, stiffness: 300 },
  },
};

// ── Scale in (for stat cards) ──
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', damping: 20, stiffness: 300 },
  },
};

// ── Slide in from right (for list items with exit) ──
export const slideItem: Variants = {
  hidden: { opacity: 0, x: -12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', damping: 20, stiffness: 300 },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.15 },
  },
};

/**
 * AnimatedPage — wraps server component content with fade-in animation.
 * Use this in server pages that can't import framer-motion directly.
 *
 * Usage: <AnimatedPage>{children}</AnimatedPage>
 */
export function AnimatedPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * AnimatedList — wraps a list with staggered children animation.
 */
export function AnimatedList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * AnimatedItem — individual stagger-animated item.
 */
export function AnimatedItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={fadeInUp} className={className}>
      {children}
    </motion.div>
  );
}

/**
 * AnimatedCard — card with hover lift + tap press effect.
 */
export function AnimatedCard({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <motion.div
      variants={fadeInUp}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      className={cn('cursor-pointer', className)}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}
