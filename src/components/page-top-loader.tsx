"use client";

import { useEffect, useRef, useState } from "react";

import { useGlobalLoading } from "@/components/global-loading-provider";

type LoaderState = {
  active: boolean;
  progress: number;
};

const INITIAL_PROGRESS = 18;
const MID_PROGRESS = 52;
const MAX_PROGRESS = 82;

export function PageTopLoader() {
  const { active } = useGlobalLoading();
  const timersRef = useRef<number[]>([]);
  const [loader, setLoader] = useState<LoaderState>({
    active: false,
    progress: 0,
  });

  const clearTimers = () => {
    for (const timer of timersRef.current) {
      window.clearTimeout(timer);
    }
    timersRef.current = [];
  };

  useEffect(() => {
    if (!active || loader.active) {
      return;
    }

    const startTimer = window.setTimeout(() => {
      clearTimers();
      setLoader({
        active: true,
        progress: INITIAL_PROGRESS,
      });

      timersRef.current.push(
        window.setTimeout(() => {
          setLoader((current) =>
            current.active
              ? { active: true, progress: Math.max(current.progress, MID_PROGRESS) }
              : current,
          );
        }, 160),
        window.setTimeout(() => {
          setLoader((current) =>
            current.active
              ? { active: true, progress: Math.max(current.progress, MAX_PROGRESS) }
              : current,
          );
        }, 520),
      );
    }, 0);

    return () => {
      window.clearTimeout(startTimer);
      clearTimers();
    };
  }, [active, loader.active]);

  useEffect(() => {
    if (active || !loader.active) {
      return;
    }

    const finishTimer = window.setTimeout(() => {
      clearTimers();
      setLoader({
        active: true,
        progress: 100,
      });

      timersRef.current.push(
        window.setTimeout(() => {
          setLoader({
            active: false,
            progress: 0,
          });
        }, 220),
      );
    }, 0);

    return () => {
      window.clearTimeout(finishTimer);
      clearTimers();
    };
  }, [active, loader.active]);

  return (
    <div
      aria-hidden={!loader.active}
      className={`pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden transition-opacity duration-200 ${
        loader.active ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="absolute inset-0 bg-border/60" />
      <div
        className="absolute left-0 top-0 h-full bg-primary shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_35%,transparent)] transition-[width] duration-200 ease-out"
        style={{ width: `${loader.progress}%` }}
      />
    </div>
  );
}

export function PageContentLoadingOverlay() {
  const { active } = useGlobalLoading();

  return (
    <div
      aria-hidden={!active}
      className={`pointer-events-none absolute inset-0 z-20 transition-opacity duration-200 ${
        active ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="absolute inset-0 bg-background/55 backdrop-blur-[1px]" />
    </div>
  );
}
