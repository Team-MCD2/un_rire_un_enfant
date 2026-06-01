import { useRegisterSW } from "virtual:pwa-register/react";
import { DownloadCloud, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ReloadPrompt = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log("SW Registered: ", r);
    },
    onRegisterError(error) {
      console.log("SW registration error", error);
    },
  });

  const close = () => {
    setNeedRefresh(false);
  };

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-24 left-4 right-4 md:left-auto md:right-4 md:w-80 z-[100] bg-primary text-primary-foreground p-4 rounded-2xl shadow-2xl flex flex-col gap-3"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <DownloadCloud size={20} />
              <p className="font-semibold text-sm">Mise à jour disponible</p>
            </div>
            <button onClick={close} className="text-primary-foreground/70 hover:text-white">
              <X size={18} />
            </button>
          </div>
          <p className="text-xs text-primary-foreground/90">
            Une nouvelle version de l'application est prête ! Cliquez ci-dessous pour rafraîchir.
          </p>
          <button
            onClick={() => updateServiceWorker(true)}
            className="w-full py-2 bg-white text-primary rounded-xl font-bold text-sm shadow-sm hover:opacity-90 transition-opacity"
          >
            Mettre à jour maintenant
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReloadPrompt;
