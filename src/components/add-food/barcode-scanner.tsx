"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, Loader2, CircleAlert } from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { cn } from "@/lib/utils";

export type BarcodeScanStatus = "scanning" | "looking-up" | "error";

interface BarcodeScannerProps {
  open: boolean;
  // Owned by the caller (add-food-sheet.tsx), since the lookup call itself
  // lives there — this component only reports a detected code and reflects
  // back whatever stage the caller says it's in.
  status: BarcodeScanStatus;
  errorMessage?: string | null;
  onClose: () => void;
  onDetected: (code: string) => void;
  onRetry: () => void;
}

// Full-screen camera overlay (above everything, including the Add Food sheet
// itself — a viewfinder needs real screen space, not a slice of a bottom
// sheet). Decoding runs continuously via @zxing/browser's ZXing-wasm port,
// not the native BarcodeDetector API — verified live that Safari (desktop
// and iOS) and Firefox have zero support for BarcodeDetector, so a
// library-based decoder is the only option that actually works across real
// devices rather than silently failing on every iPhone.
export function BarcodeScanner({ open, status, errorMessage, onClose, onDetected, onRetry }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Distinct from `status`/`errorMessage` — this is a *camera* failure
  // (permission denied, no device), not a lookup failure. Owned locally
  // since only this component talks to getUserMedia at all.
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Refs, not deps — onDetected is re-created every render by the caller,
  // and including it in the effect's deps would restart the camera (and
  // drop frames while it reinitializes) on every parent re-render. Kept
  // fresh via its own effect rather than writing to it during render.
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  });

  // Resets `cameraError` on each open/close transition without a
  // synchronous setState at the top of the camera-init effect below — same
  // render-phase "compare against a mirrored previous prop" reset already
  // used elsewhere in this codebase (e.g. CreateRecipeSheet's own
  // open-transition reset).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    setCameraError(null);
  }

  // Only actively decoding while status is "scanning" — paused (camera
  // stream stopped entirely) during "looking-up"/"error" so a still-running
  // decoder can't fire a second detection while the first one's lookup is
  // in flight. Restarts automatically once a retry brings status back to
  // "scanning".
  useEffect(() => {
    if (!open || status !== "scanning") return;
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
        setCameraError(
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Camera access was denied. Allow camera access in your browser settings to scan a barcode."
            : "Couldn't access a camera on this device.",
        );
      });

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [open, status]);

  const frameState = cameraError || status === "error" ? "error" : status === "looking-up" ? "found" : "scanning";

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

          <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4 px-10">
            {cameraError ? (
              <p className="rounded-[12px] bg-black/60 px-4 py-3 text-center text-[13px] text-white">
                {cameraError}
              </p>
            ) : (
              // Border color + a subtle scale pulse are the "did it register"
              // feedback the plain static box was missing — flips from white
              // (scanning) to green (found, looking up) to red (lookup
              // failed), a plain CSS transition rather than Motion since it's
              // a simple state-driven color/scale change, not a gesture or
              // layout animation.
              <div
                className={cn(
                  "flex aspect-3/2 w-full max-w-sm items-center justify-center rounded-2xl border-2 transition-all duration-200",
                  frameState === "found" && "scale-[1.03] border-success",
                  frameState === "error" && "border-calories",
                  frameState === "scanning" && "border-white/80",
                )}
              >
                {status === "looking-up" && <Loader2 size={26} className="animate-spin text-white" />}
                {status === "error" && <CircleAlert size={26} className="text-white" />}
              </div>
            )}

            {status === "error" && errorMessage && (
              <div className="flex flex-col items-center gap-3">
                <p className="max-w-xs text-center text-[13px] text-white">{errorMessage}</p>
                <button
                  onClick={onRetry}
                  className="rounded-full bg-white/20 px-4 py-2 text-[13px] font-medium text-white backdrop-blur-sm transition-transform active:scale-95"
                >
                  Scan again
                </button>
              </div>
            )}
          </div>

          <div className="relative z-10 px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-3">
            <p className="text-center text-[13px] text-white/70">
              {cameraError
                ? "Try searching instead."
                : status === "looking-up"
                  ? "Barcode found — looking up nutrition info…"
                  : status === "error"
                    ? "Position the barcode and try again"
                    : "Center the barcode inside the frame"}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
