import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Check } from "lucide-react";
import appIcon from "@/assets/logo.png";

type MemberType = "benevole" | "beneficiaire" | "both";

const Login = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [nickname, setNickname] = useState("");
  const [memberType, setMemberType] = useState<MemberType>("beneficiaire");
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifActivities, setNotifActivities] = useState(true);
  const [notifStories, setNotifStories] = useState(true);
  const [notifDistributions, setNotifDistributions] = useState(true);
  const [loading, setLoading] = useState(false);

  if (user) {
    navigate("/");
    return null;
  }

  const resolveEmail = (input: string) => {
    if (input.trim().toUpperCase() === "ADMIN31") return "admin31@rirepour1enfant.app";
    return input;
  };

  const showNotifPrefs = memberType === "benevole" || memberType === "both";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const resolvedEmail = resolveEmail(email);

    try {
      if (isForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(resolvedEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({ title: "Email envoyé", description: "Vérifiez votre boîte mail pour réinitialiser votre mot de passe." });
        setIsForgotPassword(false);
      } else if (isRegister) {
        if (!name.trim()) {
          toast({ title: "Erreur", description: "Le prénom est obligatoire.", variant: "destructive" });
          setLoading(false);
          return;
        }
        if (!phone.trim()) {
          toast({ title: "Erreur", description: "Le numéro de téléphone est obligatoire.", variant: "destructive" });
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: resolvedEmail,
          password,
          options: {
            data: {
              full_name: name.trim(),
              phone: phone.trim(),
              nickname: nickname.trim() || null,
              member_type: memberType,
              notif_messages: notifMessages,
              notif_activities: notifActivities,
              notif_stories: notifStories,
              notif_distributions: notifDistributions,
            },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({ title: "Inscription réussie", description: "Vérifiez votre email pour confirmer votre compte." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: resolvedEmail, password });
        if (error) throw error;
        navigate("/");
      }
    } catch (error) {
      toast({ title: "Erreur", description: (error as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const memberTypeOptions: { value: MemberType; label: string; desc: string }[] = [
    { value: "beneficiaire", label: "Bénéficiaire", desc: "Je bénéficie des actions" },
    { value: "benevole", label: "Bénévole", desc: "J'aide l'association" },
    { value: "both", label: "Les deux", desc: "Bénévole et bénéficiaire" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-6"
      >
        <div className="text-center space-y-3">
          <img src={appIcon} alt="Asso Solidaire" className="w-20 h-20 mx-auto rounded-2xl" />
          <h1 className="text-2xl font-bold text-foreground">Rire pour 1 enfant</h1>
          <p className="text-sm text-muted-foreground">
            {isForgotPassword ? "Réinitialiser le mot de passe" : isRegister ? "Créer un compte" : "Content de vous revoir"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {isRegister && !isForgotPassword && (
            <>
              <input
                type="text"
                placeholder="Prénom *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl bg-secondary text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 transition"
                required
              />
              <input
                type="tel"
                placeholder="Numéro de téléphone *"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl bg-secondary text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 transition"
                required
              />
              <input
                type="text"
                placeholder="Surnom (facultatif)"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl bg-secondary text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 transition"
              />

              {/* Member type selection */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">Vous êtes *</p>
                <div className="grid grid-cols-3 gap-2">
                  {memberTypeOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMemberType(opt.value)}
                      className={`rounded-xl px-2 py-3 text-center transition-all border ${
                        memberType === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-secondary text-muted-foreground"
                      }`}
                    >
                      <p className="text-xs font-semibold">{opt.label}</p>
                      <p className="text-[9px] mt-0.5 opacity-70">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Notification preferences for bénévoles */}
              {showNotifPrefs && (
                <div className="space-y-2 rounded-xl bg-secondary/50 p-3">
                  <p className="text-xs font-semibold text-foreground">Recevoir des notifications pour :</p>
                  {[
                    { label: "Messages", checked: notifMessages, set: setNotifMessages },
                    { label: "Activités", checked: notifActivities, set: setNotifActivities },
                    { label: "Réponses aux stories", checked: notifStories, set: setNotifStories },
                    { label: "Distributions", checked: notifDistributions, set: setNotifDistributions },
                  ].map((item) => (
                    <label key={item.label} className="flex items-center gap-2 cursor-pointer">
                      <div
                        onClick={() => item.set(!item.checked)}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                          item.checked ? "bg-primary border-primary" : "border-border bg-background"
                        }`}
                      >
                        {item.checked && <Check size={12} className="text-primary-foreground" />}
                      </div>
                      <span className="text-xs text-foreground">{item.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </>
          )}
          <input
            type="text"
            placeholder="Email *"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3.5 rounded-xl bg-secondary text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 transition"
            required
          />
          {!isForgotPassword && (
            <input
              type="password"
              placeholder="Mot de passe *"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl bg-secondary text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 transition"
              required
              minLength={6}
            />
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {isForgotPassword ? "Envoyer le lien" : isRegister ? "S'inscrire" : "Se connecter"}
          </button>
        </form>

        {!isForgotPassword && (
          <button
            onClick={() => setIsForgotPassword(true)}
            className="block mx-auto text-xs text-muted-foreground hover:text-primary transition"
          >
            Mot de passe oublié ?
          </button>
        )}

        <p className="text-center text-sm text-muted-foreground">
          {isForgotPassword ? (
            <button onClick={() => setIsForgotPassword(false)} className="text-primary font-medium">
              Retour à la connexion
            </button>
          ) : (
            <>
              {isRegister ? "Déjà un compte ?" : "Pas encore de compte ?"}{" "}
              <button onClick={() => setIsRegister(!isRegister)} className="text-primary font-medium">
                {isRegister ? "Se connecter" : "S'inscrire"}
              </button>
            </>
          )}
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
