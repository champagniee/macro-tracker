"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

// Full-screen camera overlay (above everything, including the Add Food sheet
// itself — a viewfinder needs real screen space, not a slice of a bottom
// sheet). Decoding runs continuously via @zxing/browser's ZXing-wasm port,
// not the native BarcodeDetector API — verified live that Safari (desktop
// and iOS) and Firefox have zero support for BarcodeDetector, so a
// library-based decoder is the only option that actually works across real
// devices rather than silently failing on every iPhone.
export function BarcodeScanner({ open, onClose, onDetected }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs, not deps — onDetected/onClose are re-created every render by the
  // caller, and including them in the effect's deps would restart the camera
  // (and drop frames while it reinitializes) on every parent re-render. Kept
  // fresh via its own effect rather than writing to it during render.
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  });

  // Resets `error` on each open/close transition without a synchronous
  // setState at the top of the camera-init effect below — same render-phase
  // "compare against a mirrored previous prop" reset already used elsewhere
  // in this codebase (e.g. CreateRecipeSheet's own open-transition reset).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    setError(null);
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let controls: IScannerControls | null = null;
    const reader = new BrowserMultiFormatReader();

    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result) => {
        // Fires continuously — most calls have no result (a normal "still
        // scanning" frame, not an error) and no meaningful error to surface;
        // only a real hit matters here.
        if (result && !cancelled) {
          cancelled = true;
          controls?.stop();
          onDetectedRef.current(result.getText());
        }
      })
      .then((c) => {
        if (cancelled) {
          c.stop();
        } else {
          controls = c;
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Camera access was denied. Allow camera access in your browser settings to scan a barcode."
            : "Couldn't access a camera on this device.",
        );
      });

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex flex-col bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            muted
            autoPlay
            playsInline
          />

          <div className="relative z-10 flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-3">
            <p className="text-[15px] font-medium text-white">Scan barcode</p>
            <button
              onClick={onClose}
              aria-label="Close scanner"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-transform active:scale-90"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>

          <div className="relative z-10 flex flex-1 items-center justify-center px-10">
            {error ? (
              <p className="rounded-[12px] bg-black/60 px-4 py-3 text-center text-[13px] text-white">{error}</p>
            ) : (
              <div className="aspect-[3/2] w-full max-w-sm rounded-[16px] border-2 border-white/80" />
            )}
          </div>

          <div className="relative z-10 px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-3">
            <p className="text-center text-[13px] text-white/70">
              {error ? "Try searching instead." : "Center the barcode inside the frame"}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
