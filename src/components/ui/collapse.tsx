"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

interface CollapseProps {
  open: boolean;
  children: ReactNode;
}

// Smoothly grows/shrinks around content that mounts/unmounts (a collapsible
// section's body) instead of it snapping in and jumping everything below it.
// height:0->auto is normally off the table (animating height costs layout
// every frame) but is the sanctioned exception for an accordion — Motion
// measures the real content height in JS, not a naive CSS height:auto
// transition, which doesn't animate at all.
export function Collapse({ open, children }: CollapseProps) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="collapse"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.15 : 0.2, ease: [0.23, 1, 0.32, 1] }}
          style={{ overflow: "hidden" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
