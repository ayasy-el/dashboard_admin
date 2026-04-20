"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

type GlobalLoadingContextValue = {
  active: boolean;
  startNavigation: () => void;
  stopNavigation: () => void;
  startPending: () => void;
  stopPending: () => void;
};

const GlobalLoadingContext = createContext<GlobalLoadingContextValue | null>(null);

export function GlobalLoadingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const initialRenderRef = useRef(true);
  const [navigationActive, setNavigationActive] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const startNavigation = useCallback(() => {
    setNavigationActive(true);
  }, []);

  const stopNavigation = useCallback(() => {
    setNavigationActive(false);
  }, []);

  const startPending = useCallback(() => {
    setPendingCount((count) => count + 1);
  }, []);

  const stopPending = useCallback(() => {
    setPendingCount((count) => Math.max(0, count - 1));
  }, []);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (anchor.target && anchor.target !== "_self") {
        return;
      }

      if (anchor.hasAttribute("download")) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) {
        return;
      }

      const nextUrl = new URL(anchor.href, window.location.href);
      const currentUrl = new URL(window.location.href);

      if (nextUrl.origin !== currentUrl.origin) {
        return;
      }

      if (nextUrl.href === currentUrl.href) {
        return;
      }

      startNavigation();
    };

    const handlePopState = () => {
      startNavigation();
    };

    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [startNavigation]);

  useEffect(() => {
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      return;
    }

    const stopTimer = window.setTimeout(() => {
      stopNavigation();
    }, 0);

    return () => {
      window.clearTimeout(stopTimer);
    };
  }, [pathname, stopNavigation]);

  const value = useMemo<GlobalLoadingContextValue>(
    () => ({
      active: navigationActive || pendingCount > 0,
      startNavigation,
      stopNavigation,
      startPending,
      stopPending,
    }),
    [navigationActive, pendingCount, startNavigation, startPending, stopNavigation, stopPending],
  );

  return <GlobalLoadingContext.Provider value={value}>{children}</GlobalLoadingContext.Provider>;
}

export function useGlobalLoading() {
  const context = useContext(GlobalLoadingContext);

  if (!context) {
    throw new Error("useGlobalLoading must be used within GlobalLoadingProvider.");
  }

  return context;
}

export function useBindGlobalLoading(pending: boolean) {
  const { startPending, stopPending } = useGlobalLoading();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (pending && !registeredRef.current) {
      registeredRef.current = true;
      startPending();
    }

    if (!pending && registeredRef.current) {
      registeredRef.current = false;
      stopPending();
    }

    return () => {
      if (registeredRef.current) {
        registeredRef.current = false;
        stopPending();
      }
    };
  }, [pending, startPending, stopPending]);
}
