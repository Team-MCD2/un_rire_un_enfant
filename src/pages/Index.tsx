import { useState, useEffect } from "react";
import { Plus, X, Send, CloudSun, MapPin, Loader2, ClipboardList, Calendar, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { sendLocalNotification, requestNotificationPermission } from "@/lib/notifications";
import PageHeader from "@/components/PageHeader";
import ActivityCard from "@/components/ActivityCard";
import heroImg from "@/assets/hero-activities.jpg";
import artImg from "@/assets/activity-art.jpg";
import studyImg from "@/assets/activity-study.jpg";


const POPULAR_CITIES = [
  "Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Strasbourg",
  "Montpellier", "Bordeaux", "Lille", "Rennes", "Grenoble", "Toulon",
];

interface WeatherData {
  temp: number;
  description: string;
  icon: string;
  city: string;
}

interface Proposal {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  proposed_date: string | null;
  location: string | null;
  city: string | null;
  status: string;
  created_at: string;
}

type PageTab = "activities" | "proposals";

const Index = () => {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: "", description: "", category: "", date: "", location: "", city: "" });
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<PageTab>("activities");
  const [myProposals, setMyProposals] = useState<Proposal[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [approvedActivities, setApprovedActivities] = useState<Proposal[]>([]);

  // Fetch approved activities
  useEffect(() => {
    const fetchApproved = async () => {
      const { data } = await supabase
        .from("activity_proposals")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (data) setApprovedActivities(data as Proposal[]);
    };
    fetchApproved();
  }, [showForm]);

  // Fetch user proposals
  useEffect(() => {
    if (!user) return;
    const fetchProposals = async () => {
      setLoadingProposals(true);
      const { data } = await supabase
        .from("activity_proposals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) setMyProposals(data as Proposal[]);
      setLoadingProposals(false);
    };
    fetchProposals();
  }, [user, showForm]);

  // Fetch weather when city changes
  useEffect(() => {
    if (!formData.city || formData.city.length < 2) {
      setWeather(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoadingWeather(true);
      try {
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(formData.city)}&count=1&language=fr`
        );
        const geoData = await geoRes.json();
        if (geoData.results && geoData.results.length > 0) {
          const { latitude, longitude, name } = geoData.results[0];
          const weatherRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`
          );
          const weatherData = await weatherRes.json();
          const wmo = weatherData.current_weather;
          const desc = getWeatherDescription(wmo.weathercode);
          const icon = getWeatherEmoji(wmo.weathercode);
          setWeather({ temp: Math.round(wmo.temperature), description: desc, icon, city: name });
        } else {
          setWeather(null);
        }
      } catch {
        setWeather(null);
      } finally {
        setLoadingWeather(false);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [formData.city]);

  const getWeatherDescription = (code: number): string => {
    if (code === 0) return "Ciel dégagé";
    if (code <= 3) return "Partiellement nuageux";
    if (code <= 48) return "Brouillard";
    if (code <= 57) return "Bruine";
    if (code <= 67) return "Pluie";
    if (code <= 77) return "Neige";
    if (code <= 82) return "Averses";
    if (code <= 86) return "Averses de neige";
    return "Orage";
  };

  const getWeatherEmoji = (code: number): string => {
    if (code === 0) return "☀️";
    if (code <= 3) return "⛅";
    if (code <= 48) return "🌫️";
    if (code <= 57) return "🌧️";
    if (code <= 67) return "🌧️";
    if (code <= 77) return "❄️";
    if (code <= 82) return "🌦️";
    if (code <= 86) return "🌨️";
    return "⛈️";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: "Connexion requise", description: "Connectez-vous pour proposer une activité.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("activity_proposals").insert({
        user_id: user.id,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        proposed_date: formData.date || null,
        location: formData.location,
        city: formData.city,
      });

      if (error) throw error;

      toast({ title: "Activité proposée ✅", description: "Un administrateur va valider votre proposition." });

      const hasPermission = await requestNotificationPermission();
      if (hasPermission) {
        sendLocalNotification("Nouvelle proposition d'activité 🎯", {
          body: `${formData.title} — ${formData.city || formData.location}`,
          tag: "activity-proposal",
        });
      }

      setFormData({ title: "", description: "", category: "", date: "", location: "", city: "" });
      setShowForm(false);
    } catch (err) {
      toast({ title: "Erreur", description: "Impossible d'envoyer la proposition.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProposal = async (id: string, title: string) => {
    const { error } = await supabase.from("activity_proposals").delete().eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: "Impossible de supprimer.", variant: "destructive" });
      return;
    }
    setMyProposals((prev) => prev.filter((p) => p.id !== id));
    toast({ title: "Supprimée", description: `"${title}" a été supprimée.` });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return { label: "⏳ En attente", classes: "bg-accent/10 text-accent" };
      case "approved":
        return { label: "✅ Validée", classes: "bg-primary/10 text-primary" };
      case "rejected":
        return { label: "❌ Refusée", classes: "bg-destructive/10 text-destructive" };
      default:
        return { label: status, classes: "bg-secondary text-muted-foreground" };
    }
  };

  return (
    <div className="min-h-screen bg-background safe-bottom">
      <PageHeader title="Activités" subtitle="Découvrez nos prochains événements" />



      {/* Tabs */}
      {user && (
        <div className="sticky top-[60px] z-30 glass px-4 py-2">
          <div className="max-w-lg mx-auto flex gap-2">
            <button
              onClick={() => setActiveTab("activities")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === "activities" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <Calendar size={16} />
              Activités
            </button>
            <button
              onClick={() => setActiveTab("proposals")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === "proposals" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <ClipboardList size={16} />
              Mes propositions
              {myProposals.filter(p => p.status === "pending").length > 0 && (
                <span className="ml-1 w-5 h-5 rounded-full bg-accent text-accent-foreground text-[10px] flex items-center justify-center font-bold">
                  {myProposals.filter(p => p.status === "pending").length}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Activities list */}
      {activeTab === "activities" && (
        <main className="px-4 py-4 space-y-4 max-w-lg mx-auto">
          {approvedActivities.length === 0 ? (
            <div className="text-center py-12">
              <Calendar size={40} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Aucune activité pour le moment.</p>
              <p className="text-xs text-muted-foreground mt-1">Proposez-en une avec le bouton +</p>
            </div>
          ) : (
            approvedActivities.map((activity, i) => (
              <ActivityCard
                key={activity.id}
                title={activity.title}
                date={activity.proposed_date ? new Date(activity.proposed_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : "Date à définir"}
                location={activity.location || activity.city || "Lieu à définir"}
                image={heroImg}
                participants={0}
                index={i}
              />
            ))
          )}
        </main>
      )}

      {/* My proposals */}
      {activeTab === "proposals" && (
        <main className="px-4 py-4 space-y-3 max-w-lg mx-auto">
          {!user ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">Connectez-vous pour voir vos propositions.</p>
              <a href="/login" className="text-primary text-sm font-medium mt-2 inline-block">Se connecter</a>
            </div>
          ) : loadingProposals ? (
            <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>
          ) : myProposals.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList size={40} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Vous n'avez pas encore proposé d'activité.</p>
              <button onClick={() => { setActiveTab("activities"); setShowForm(true); }}
                className="mt-3 text-primary text-sm font-medium">
                Proposer une activité →
              </button>
            </div>
          ) : (
            myProposals.map((p, i) => {
              const badge = getStatusBadge(p.status);
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-card border border-border rounded-2xl p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{p.title}</p>
                      {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
                    </div>
                    <span className={`text-[11px] font-medium px-2 py-1 rounded-lg shrink-0 ${badge.classes}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                    {p.category && <span className="bg-secondary px-2 py-0.5 rounded-lg">{p.category}</span>}
                    {p.city && <span className="bg-secondary px-2 py-0.5 rounded-lg">📍 {p.city}</span>}
                    {p.location && <span className="bg-secondary px-2 py-0.5 rounded-lg">{p.location}</span>}
                    {p.proposed_date && <span className="bg-secondary px-2 py-0.5 rounded-lg">📅 {new Date(p.proposed_date).toLocaleDateString("fr-FR")}</span>}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground/60">
                      Proposée le {new Date(p.created_at).toLocaleDateString("fr-FR")}
                    </p>
                    <button
                      onClick={() => handleDeleteProposal(p.id, p.title)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors"
                    >
                      <Trash2 size={12} /> Supprimer
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </main>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowForm(true)}
        className="fixed right-4 bottom-24 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
      >
        <Plus size={24} />
      </button>

      {/* Drawer */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-foreground/40 z-50"
              onClick={() => setShowForm(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[80] bg-background rounded-t-3xl flex flex-col max-h-[88dvh]"
            >
              <div className="flex items-center justify-between p-6 pb-2">
                <h2 className="text-lg font-bold">Proposer une activité</h2>
                <button onClick={() => setShowForm(false)}>
                  <X size={20} className="text-muted-foreground" />
                </button>
              </div>
              <form className="flex flex-col flex-1 overflow-hidden" onSubmit={handleSubmit}>
                <div className="space-y-4 px-6 py-2 overflow-auto flex-1 pb-28">
                {[
                  { label: "Titre", key: "title", type: "text", placeholder: "Ex: Sortie au parc" },
                  { label: "Description", key: "description", type: "text", placeholder: "Décrivez l'activité" },
                  { label: "Catégorie", key: "category", type: "text", placeholder: "Sport, Culture, Aide..." },
                  { label: "Date", key: "date", type: "date", placeholder: "" },
                  { label: "Lieu", key: "location", type: "text", placeholder: "Ex: Parc Borély" },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="text-sm font-medium text-foreground mb-1 block">{field.label}</label>
                    <input
                      type={field.type}
                      value={formData[field.key as keyof typeof formData]}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 transition placeholder:text-muted-foreground/50"
                      required={field.key === "title"}
                    />
                  </div>
                ))}

                {/* City + Weather */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 flex items-center gap-1.5">
                    <MapPin size={14} className="text-primary" />
                    Ville (pour la météo)
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Ex: Toulouse"
                    className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 transition placeholder:text-muted-foreground/50"
                    list="city-suggestions"
                  />
                  <datalist id="city-suggestions">
                    {POPULAR_CITIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                {/* Weather card */}
                <AnimatePresence mode="wait">
                  {loadingWeather && (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2 text-sm text-muted-foreground py-2"
                    >
                      <Loader2 size={16} className="animate-spin" />
                      Chargement météo…
                    </motion.div>
                  )}
                  {!loadingWeather && weather && (
                    <motion.div
                      key="weather"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="rounded-2xl bg-primary/5 border border-primary/15 p-4 flex items-center gap-4"
                    >
                      <span className="text-3xl">{weather.icon}</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          {weather.city} — {weather.temp}°C
                        </p>
                        <p className="text-xs text-muted-foreground">{weather.description}</p>
                      </div>
                      <CloudSun size={20} className="text-primary/60" />
                    </motion.div>
                  )}
                </AnimatePresence>
                </div>

                <div className="sticky bottom-4 z-10 mx-4 mb-4 rounded-3xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/90">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 rounded-2xl bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
                  >
                    {submitting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                    {submitting ? "Envoi…" : "Envoyer la proposition"}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;