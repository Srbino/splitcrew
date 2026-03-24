'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export function Modal({ isOpen, onClose, title, children, footer, size = 'md' }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Content */}
          <motion.div
            className={cn(
              'relative w-full rounded-xl bg-card border border-border shadow-lg overflow-hidden',
              sizeClasses[size],
            )}
            onClick={e => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{
              type: 'spring',
              damping: 25,
              stiffness: 350,
              mass: 0.8,
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-base font-semibold">{title}</h3>
              <button
                onClick={onClose}
                className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-accent transition-colors border-none bg-transparent cursor-pointer"
                aria-label="Close"
              >
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">{children}</div>

            {/* Footer */}
            {footer && (
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-muted/30">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
