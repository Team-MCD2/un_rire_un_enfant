import { useState, useEffect } from "react";
import { Heart, MessageSquare, ExternalLink, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import PageHeader from "@/components/PageHeader";

const donationAmounts = [
  { amount: 1, emoji: "💛" },
  { amount: 2, emoji: "🧡" },
  { amount: 5, emoji: "❤️" },
  { amount: 10, emoji: "💎" },
];

interface Donation {
  id: string;
  donor_name: string;
  amount: number;
  created_at: string;
}

const Support = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [donorName, setDonorName] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [paypalLink, setPaypalLink] = useState("https://paypal.me/rirepour1enfant");

  useEffect(() => {
    fetchDonations();
    fetchPaypalLink();
  }, []);

  const fetchDonations = async () => {
    const { data } = await supabase
      .from("donations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setDonations(data as Donation[]);
  };

  const fetchPaypalLink = async () => {
    const { data } = await supabase.from("app_settings").select("value").eq("key", "paypal_link").maybeSingle();
    if (data) setPaypalLink(data.value);
  };

  const handleDonate = (amount: number) => {
    setSelectedAmount(amount);
    setShowNameInput(true);
    setDonorName(profile?.full_name || "");
  };

  const confirmDonation = async () => {
    if (!selectedAmount) return;
    // Record the donation
    if (user) {
      await supabase.from("donations").insert({
        user_id: user.id,
        donor_name: donorName.trim() || "Anonyme",
        amount: selectedAmount,
      });
    }
    // Open PayPal
    window.open(`${paypalLink}/${selectedAmount}`, "_blank");
    setShowNameInput(false);
    setSelectedAmount(null);
    fetchDonations();
    toast({ title: "Merci ! 🎉", description: "Votre générosité fait la différence." });
  };

  return (
    <div className="min-h-screen bg-background safe-bottom">
      <PageHeader title="Soutenir" subtitle="Chaque geste compte" />

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
            <Heart size={28} className="text-accent" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Soutenir Rire pour 1 enfant</h2>
          <p className="text-sm text-muted-foreground">Votre don aide les enfants et étudiants dans le besoin</p>
        </motion.div>

        {/* 4 Donation amounts */}
        <div className="grid grid-cols-4 gap-2">
          {donationAmounts.map((d, i) => (
            <motion.button
              key={d.amount}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              onClick={() => handleDonate(d.amount)}
              className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center gap-2 hover:border-primary/30 hover:shadow-md transition-all"
            >
              <span className="text-2xl">{d.emoji}</span>
              <span className="text-xl font-bold text-foreground">{d.amount}€</span>
            </motion.button>
          ))}
        </div>

        {/* Name input modal */}
        {showNameInput && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <p className="text-sm font-medium text-foreground">Comment voulez-vous apparaître sur le Wall of Fame ?</p>
            <input
              value={donorName}
              onChange={(e) => setDonorName(e.target.value)}
              placeholder="Votre nom (ou laissez vide pour Anonyme)"
              className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 transition"
            />
            <div className="flex gap-2">
              <button onClick={confirmDonation}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm">
                Confirmer {selectedAmount}€
              </button>
              <button onClick={() => setShowNameInput(false)}
                className="px-4 py-3 rounded-xl bg-secondary text-muted-foreground text-sm">
                Annuler
              </button>
            </div>
          </motion.div>
        )}

        {/* PayPal libre */}
        <motion.a
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          href={paypalLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl bg-[hsl(210,100%,45%)] text-[hsl(0,0%,100%)] font-semibold text-sm hover:opacity-90 transition"
        >
          <img src="https://www.paypalobjects.com/webstatic/mktg/Logo/pp-logo-100px.png" alt="PayPal" className="h-5" />
          Montant libre via PayPal
          <ExternalLink size={14} />
        </motion.a>

        {/* Contact admins */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          onClick={() => navigate("/contact")}
          className="w-full bg-secondary rounded-2xl p-4 flex items-center justify-center gap-3 hover:bg-secondary/80 transition"
        >
          <MessageSquare size={16} className="text-primary" />
          <span className="text-sm font-medium text-foreground">Contacter les responsables</span>
        </motion.button>

        {/* Wall of Fame */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="space-y-3">
          <div className="flex items-center gap-2">
            <Trophy size={20} className="text-accent" />
            <h3 className="text-lg font-bold text-foreground">Wall of Fame</h3>
          </div>
          {donations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Soyez le premier donateur ! 🌟</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {donations.map((d, i) => (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + i * 0.05 }}
                  className="bg-card border border-border rounded-xl p-3 text-center"
                >
                  <p className="text-sm font-medium text-foreground truncate">{d.donor_name}</p>
                  <p className="text-xs text-accent font-bold">{d.amount}€</p>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default Support;
