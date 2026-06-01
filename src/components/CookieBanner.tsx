import { useState, useEffect } from "react";
import { Cookie, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CookieBanner = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already accepted cookies
    const hasAccepted = localStorage.getItem("rgpd_cookies_accepted");
    if (!hasAccepted) {
      // Small delay so it doesn't pop aggressively instantly
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("rgpd_cookies_accepted", "true");
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-20 left-4 right-4 z-50 md:bottom-6 md:left-auto md:right-6 md:max-w-sm"
        >
          <div className="bg-card border border-border shadow-2xl rounded-2xl p-4 pr-10 relative">
            <button 
              onClick={() => setIsVisible(false)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition"
            >
              <X size={16} />
            </button>
            <div className="flex gap-3 items-start">
              <div className="p-2 bg-primary/10 rounded-full text-primary shrink-0">
                <Cookie size={20} />
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-foreground">Respect de votre vie privée</h4>
                <p className="text-xs text-muted-foreground">
                  Nous utilisons uniquement des cookies techniques essentiels pour vous garder connecté. Aucune donnée n'est revendue.
                </p>
                <div className="pt-1">
                  <button 
                    onClick={handleAccept}
                    className="w-full bg-primary text-primary-foreground text-xs font-bold py-2 rounded-xl hover:opacity-90 transition"
                  >
                    J'accepte
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CookieBanner;
