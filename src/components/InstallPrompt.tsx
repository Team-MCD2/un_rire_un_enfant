import { useEffect, useState } from "react";
import { X, Download, Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { requestNotificationPermission } from "@/lib/notifications";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showNotif, setShowNotif] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      const dismissed = localStorage.getItem("install-dismissed");
      if (!dismissed) setShowInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Check if notifications not yet granted and app is installed or standalone
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    if (isStandalone && "Notification" in window && Notification.permission === "default") {
      const notifDismissed = localStorage.getItem("notif-dismissed");
      if (!notifDismissed) {
        setTimeout(() => setShowNotif(true), 2000);
      }
    }

    // Also show notification prompt after install
    window.addEventListener("appinstalled", () => {
      setShowInstall(false);
      setDeferredPrompt(null);
      if ("Notification" in window && Notification.permission === "default") {
        setTimeout(() => setShowNotif(true), 1500);
      }
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Show notification prompt on first visit if not standalone
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      const notifDismissed = localStorage.getItem("notif-dismissed");
      if (!notifDismissed && !showInstall) {
        const timer = setTimeout(() => setShowNotif(true), 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [showInstall]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowInstall(false);
    }
    setDeferredPrompt(null);
  };

  const dismissInstall = () => {
    setShowInstall(false);
    localStorage.setItem("install-dismissed", "1");
  };

  const handleNotif = async () => {
    await requestNotificationPermission();
    setShowNotif(false);
    localStorage.setItem("notif-dismissed", "1");
  };

  const dismissNotif = () => {
    setShowNotif(false);
    localStorage.setItem("notif-dismissed", "1");
  };

  return (
    <AnimatePresence>
      {showInstall && (
        <motion.div
          key="install"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-20 left-4 right-4 z-[100] rounded-2xl bg-primary p-4 shadow-lg"
        >
          <button onClick={dismissInstall} className="absolute top-2 right-2 text-primary-foreground/60">
            <X size={18} />
          </button>
          <div className="flex items-center gap-3">
            <Download size={24} className="text-primary-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-primary-foreground">Installer l'application</p>
              <p className="text-xs text-primary-foreground/70">Accédez rapidement depuis votre écran d'accueil</p>
            </div>
            <button
              onClick={handleInstall}
              className="shrink-0 rounded-xl bg-primary-foreground px-4 py-2 text-xs font-bold text-primary"
            >
              Installer
            </button>
          </div>
        </motion.div>
      )}

      {showNotif && !showInstall && (
        <motion.div
          key="notif"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-20 left-4 right-4 z-[100] rounded-2xl bg-accent p-4 shadow-lg"
        >
          <button onClick={dismissNotif} className="absolute top-2 right-2 text-accent-foreground/60">
            <X size={18} />
          </button>
          <div className="flex items-center gap-3">
            <Bell size={24} className="text-accent-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-accent-foreground">Activer les notifications</p>
              <p className="text-xs text-accent-foreground/70">Restez informé des nouvelles activités et messages</p>
            </div>
            <button
              onClick={handleNotif}
              className="shrink-0 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              Activer
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InstallPrompt;
