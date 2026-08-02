"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname } from "next/navigation";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PwaState = {
  installed: boolean;
  isIos: boolean;
  canInstall: boolean; // native prompt captured (Android / desktop Chrome)
  promptInstall: () => Promise<void>;
};

const PwaContext = createContext<PwaState | null>(null);
export const usePwa = () => useContext(PwaContext);

const INSTALLED_KEY = "ppc-installed"; // localStorage — persists once installed
const SNOOZE_KEY = "ppc-install-snooze"; // sessionStorage — "Not now" for this session

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Register the service worker.
    if ("serviceWorker" in navigator) {
      const reg = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
      if (document.readyState === "complete") reg();
      else window.addEventListener("load", reg);
    }

    // Already running as an installed app? Then never nag.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone || localStorage.getItem(INSTALLED_KEY)) setInstalled(true);

    // iOS Safari has no install prompt — it uses Share → Add to Home Screen.
    const ua = window.navigator.userAgent;
    setIsIos(
      /iphone|ipad|ipod/i.test(ua) &&
        /safari/i.test(ua) &&
        !/crios|fxios|edgios/i.test(ua)
    );

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      try {
        localStorage.setItem(INSTALLED_KEY, "1");
      } catch {}
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }, [deferred]);

  return (
    <PwaContext.Provider
      value={{ installed, isIos, canInstall: !!deferred, promptInstall }}
    >
      {children}
    </PwaContext.Provider>
  );
}

// Auto pop-up shown inside the app (after login) — reminds every session until
// the app is installed, then never again.
export function InstallBanner() {
  const pwa = usePwa();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const inApp = /^\/(client|admin|worker)/.test(pathname || "");

  useEffect(() => {
    if (!pwa || pwa.installed || !inApp) {
      setOpen(false);
      return;
    }
    if (sessionStorage.getItem(SNOOZE_KEY)) {
      setOpen(false);
      return;
    }
    if (pwa.canInstall || pwa.isIos) setOpen(true);
  }, [pwa, inApp, pathname]);

  if (!open || !pwa) return null;

  function snooze() {
    try {
      sessionStorage.setItem(SNOOZE_KEY, "1");
    } catch {}
    setOpen(false);
  }

  return (
    <div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-sm rounded-2xl border border-border bg-white p-4 shadow-lg md:bottom-4">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="h-11 w-11 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="font-bold">Install the Paws Playcare app</p>
          {pwa.isIos ? (
            <p className="text-sm text-muted">
              Tap the Share button, then{" "}
              <span className="font-semibold">Add to Home Screen</span>.
            </p>
          ) : (
            <p className="text-sm text-muted">
              Add it to your home screen for quick, app-like access.
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={snooze} className="btn-ghost text-sm">
          Not now
        </button>
        {!pwa.isIos && (
          <button
            onClick={() => pwa.promptInstall()}
            className="btn-primary text-sm"
          >
            Install
          </button>
        )}
      </div>
    </div>
  );
}

// Menu entry — appears in the app nav until installed.
export function InstallMenuButton({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "chip";
}) {
  const pwa = usePwa();
  const [showIosHint, setShowIosHint] = useState(false);

  if (!pwa || pwa.installed || (!pwa.canInstall && !pwa.isIos)) return null;

  const onClick = () => {
    if (pwa.isIos) setShowIosHint((v) => !v);
    else pwa.promptInstall();
  };

  if (variant === "chip") {
    return (
      <div className="relative">
        <button
          onClick={onClick}
          className="flex items-center gap-1.5 rounded-lg bg-brand-soft px-2.5 py-1.5 text-xs font-bold text-brand-dark"
        >
          <DownloadIcon className="h-4 w-4" />
          Install
        </button>
        {showIosHint && (
          <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-white p-3 text-xs text-muted shadow-lg">
            Tap the Share button, then{" "}
            <span className="font-semibold text-foreground">Add to Home Screen</span>.
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-xl bg-brand-soft px-3 py-2.5 text-[0.9rem] font-semibold text-brand-dark transition hover:bg-brand/15"
      >
        <DownloadIcon className="h-[1.15rem] w-[1.15rem] shrink-0" />
        <span className="flex-1 text-left">Install app</span>
      </button>
      {showIosHint && (
        <p className="mt-2 px-3 text-xs text-muted">
          Tap the Share button, then{" "}
          <span className="font-semibold">Add to Home Screen</span>.
        </p>
      )}
    </div>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 3v12m0 0l4-4m-4 4l-4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
