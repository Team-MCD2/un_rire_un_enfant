import { ArrowLeft, Shield, FileText, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const Legal = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background safe-bottom pb-24">
      <header className="sticky top-0 z-40 glass safe-top px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <h1 className="text-lg font-bold">Légal & Confidentialité</h1>
      </header>

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        
        {/* Mentions Légales */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-primary" />
            <h2 className="text-lg font-bold">Mentions Légales</h2>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-sm text-muted-foreground space-y-2">
            <p><strong className="text-foreground">Éditeur :</strong> Association "Rire pour 1 enfant" (Association Loi 1901).</p>
            <p><strong className="text-foreground">Siège Social :</strong> 123 rue de la Solidarité, 13000 Marseille.</p>
            <p><strong className="text-foreground">Directeur de publication :</strong> Le Bureau de l'association.</p>
            <p><strong className="text-foreground">Hébergement :</strong> Vercel Inc. / Supabase Inc.</p>
          </div>
        </motion.section>

        {/* Politique de confidentialité (RGPD) */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-green-500" />
            <h2 className="text-lg font-bold">Politique de Confidentialité (RGPD)</h2>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-sm text-muted-foreground space-y-3">
            <p>
              Dans le cadre de l'utilisation de l'application, nous collectons des données strictement nécessaires au bon fonctionnement de l'association (Nom, Prénom, Email, Numéro de téléphone).
            </p>
            <p>
              <strong className="text-foreground">Vos droits :</strong> Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez d'un droit d'accès, de rectification, et de suppression de vos données personnelles. Vous pouvez exercer ce droit en modifiant votre profil ou en nous contactant via la page Soutenir.
            </p>
            <p>
              <strong className="text-foreground">Sécurité :</strong> Vos mots de passe sont cryptés et stockés de manière sécurisée. Nous ne revendons aucune donnée à des tiers.
            </p>
          </div>
        </motion.section>

        {/* Cookies */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-3">
          <div className="flex items-center gap-2">
            <Lock size={20} className="text-accent" />
            <h2 className="text-lg font-bold">Gestion des Cookies</h2>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-sm text-muted-foreground space-y-2">
            <p>
              Nous utilisons uniquement des cookies techniques essentiels pour maintenir votre session de connexion active (Supabase Auth). Aucun cookie de ciblage publicitaire n'est utilisé sur cette application.
            </p>
          </div>
        </motion.section>

      </main>
    </div>
  );
};

export default Legal;
