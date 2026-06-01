import { useEffect, useState } from "react";
import { MapPin, Calendar, UtensilsCrossed, Users, Plus, X, Trash2, Loader2, Map as MapIcon, List as ListIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import distImg from "@/assets/distribution.jpg";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Fix Leaflet icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface DistEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string;
  location: string;
  meals_available: number;
  created_by: string;
}

const Distribution = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<DistEvent[]>([]);
  const [registrations, setRegistrations] = useState<Record<string, number>>({});
  const [myRegistrations, setMyRegistrations] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ title: "", description: "", date: "", time: "18h00", location: "", meals: "50" });
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [coords, setCoords] = useState<Record<string, [number, number]>>({});

  // Check admin
  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => setIsAdmin(Boolean(data)));
  }, [user]);

  // Fetch events + registrations
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const [{ data: evts }, { data: regs }] = await Promise.all([
        supabase.from("distributions").select("*").order("event_date", { ascending: true }),
        supabase.from("distribution_registrations").select("distribution_id, user_id"),
      ]);

      if (evts) setEvents(evts as DistEvent[]);

      // Count registrations per event
      const counts: Record<string, number> = {};
      const mine = new Set<string>();
      (regs ?? []).forEach((r) => {
        counts[r.distribution_id] = (counts[r.distribution_id] || 0) + 1;
        if (user && r.user_id === user.id) mine.add(r.distribution_id);
      });
      setRegistrations(counts);
      setMyRegistrations(mine);
      setLoading(false);

      // Fetch coords for map
      evts?.forEach(async (evt: any) => {
        try {
          const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(evt.location)}&count=1&language=fr`);
          const data = await res.json();
          if (data.results && data.results.length > 0) {
            setCoords(prev => ({ ...prev, [evt.id]: [data.results[0].latitude, data.results[0].longitude] }));
          }
        } catch {
          // Silent fallback
        }
      });
    };
    fetch();
  }, [user, showForm]);

  const toggleRegistration = async (eventId: string) => {
    if (!user) {
      toast({ title: "Connexion requise", variant: "destructive" });
      return;
    }

    if (myRegistrations.has(eventId)) {
      const { error } = await supabase.from("distribution_registrations")
        .delete().eq("distribution_id", eventId).eq("user_id", user.id);
      if (error) { toast({ title: "Erreur", variant: "destructive" }); return; }
      setMyRegistrations(prev => { const n = new Set(prev); n.delete(eventId); return n; });
      setRegistrations(prev => ({ ...prev, [eventId]: (prev[eventId] || 1) - 1 }));
      toast({ title: "Désinscription confirmée ✅" });
    } else {
      const { error } = await supabase.from("distribution_registrations")
        .insert({ distribution_id: eventId, user_id: user.id });
      if (error) { toast({ title: "Erreur", variant: "destructive" }); return; }
      setMyRegistrations(prev => new Set(prev).add(eventId));
      setRegistrations(prev => ({ ...prev, [eventId]: (prev[eventId] || 0) + 1 }));
      toast({ title: "Inscription confirmée ✅" });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("distributions").delete().eq("id", id);
    if (error) { toast({ title: "Erreur", variant: "destructive" }); return; }
    setEvents(prev => prev.filter(e => e.id !== id));
    toast({ title: "Distribution supprimée ✅" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("distributions").insert({
        created_by: user.id,
        title: formData.title,
        description: formData.description || null,
        event_date: formData.date,
        event_time: formData.time,
        location: formData.location,
        meals_available: parseInt(formData.meals) || 50,
      });
      if (error) throw error;
      
      // Notify beneficiaries (push + email)
      try {
        await Promise.all([
          supabase.functions.invoke("notify-distribution", {
            body: {
              title: formData.title,
              description: formData.description || null,
              event_date: formData.date,
              event_time: formData.time,
              location: formData.location,
            },
          }),
          supabase.functions.invoke("send-email", {
            body: {
              type: "distribution",
              title: formData.title,
              description: formData.description || null,
              event_date: formData.date,
              event_time: formData.time,
              location: formData.location,
            },
          }),
        ]);
      } catch (e) {
        console.error("Notification error:", e);
      }
      
      toast({ title: "Distribution créée ✅" });
      setFormData({ title: "", description: "", date: "", time: "18h00", location: "", meals: "50" });
      setShowForm(false);
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background safe-bottom">
      <PageHeader title="Distribution" subtitle="Aide alimentaire étudiante" />

      {/* Hero banner */}
      <div className="relative mx-4 mt-4 rounded-2xl overflow-hidden aspect-[2/1]">
        <img src={distImg} alt="Distribution alimentaire" className="w-full h-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 to-transparent flex items-end p-4">
          <p className="text-primary-foreground text-sm font-medium">
            Inscrivez-vous aux prochaines distributions 🍽️
          </p>
        </div>
      </div>

      <main className="px-4 py-4 space-y-3 max-w-lg mx-auto">
        {events.length > 0 && (
          <div className="flex justify-end mb-2">
            <div className="bg-secondary p-1 rounded-xl flex text-sm font-medium">
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${viewMode === "list" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <ListIcon size={14} /> Liste
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${viewMode === "map" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <MapIcon size={14} /> Carte
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <UtensilsCrossed size={40} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Aucune distribution prévue pour le moment.</p>
            {isAdmin && <p className="text-xs text-muted-foreground mt-1">Créez-en une avec le bouton +</p>}
          </div>
        ) : viewMode === "map" ? (
          <div className="h-[400px] rounded-2xl overflow-hidden border border-border shadow-sm z-0 relative">
            <MapContainer center={[43.2965, 5.3698]} zoom={12} style={{ height: "100%", width: "100%" }}>
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {events.map((evt) => {
                const coord = coords[evt.id];
                if (!coord) return null;
                const count = registrations[evt.id] || 0;
                const isFull = count >= evt.meals_available;
                return (
                  <Marker key={evt.id} position={coord}>
                    <Popup className="rounded-xl">
                      <div className="p-1 min-w-[200px]">
                        <p className="font-bold text-sm mb-1">{evt.title}</p>
                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><MapPin size={10} /> {evt.location}</p>
                        <p className="text-xs mb-2">📅 {new Date(evt.event_date).toLocaleDateString("fr-FR")} à {evt.event_time}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                            {evt.meals_available - count} repas
                          </span>
                          <button
                            onClick={() => toggleRegistration(evt.id)}
                            disabled={isFull && !myRegistrations.has(evt.id)}
                            className={`px-3 py-1 text-[11px] rounded-md font-bold text-white ${
                              myRegistrations.has(evt.id) ? "bg-destructive" : isFull ? "bg-muted-foreground cursor-not-allowed" : "bg-primary"
                            }`}
                          >
                            {myRegistrations.has(evt.id) ? "Désinscrire" : isFull ? "Complet" : "M'inscrire"}
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        ) : (
          events.map((evt, i) => {
            const count = registrations[evt.id] || 0;
            const isFull = count >= evt.meals_available;
            const isRegistered = myRegistrations.has(evt.id);
            return (
              <motion.div
                key={evt.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-card rounded-2xl p-4 border border-border shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{evt.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar size={12} /> {new Date(evt.event_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} à {evt.event_time}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin size={12} /> {evt.location}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                    <UtensilsCrossed size={12} />
                    {evt.meals_available - count} restants
                  </div>
                </div>

                {evt.description && <p className="text-sm text-foreground">{evt.description}</p>}

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users size={12} /> {count} inscrits
                  </span>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(evt.id)}
                        className="flex items-center gap-1 rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground transition-colors hover:bg-destructive/90"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                    <button
                      onClick={() => toggleRegistration(evt.id)}
                      disabled={isFull && !isRegistered}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isRegistered
                          ? "bg-destructive/10 text-destructive"
                          : isFull
                          ? "bg-muted text-muted-foreground cursor-not-allowed"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      {isRegistered ? "Je ne viens plus" : isFull ? "Complet" : "Je viens"}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}

      </main>

      {/* Admin FAB */}
      {isAdmin && (
        <button
          onClick={() => setShowForm(true)}
          className="fixed right-4 bottom-24 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
        >
          <Plus size={24} />
        </button>
      )}

      {/* Admin create form */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-foreground/40 z-50" onClick={() => setShowForm(false)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[80] bg-background rounded-t-3xl flex flex-col max-h-[88dvh]"
            >
              <div className="flex items-center justify-between p-6 pb-2">
                <h2 className="text-lg font-bold">Nouvelle distribution</h2>
                <button onClick={() => setShowForm(false)}><X size={20} className="text-muted-foreground" /></button>
              </div>
              <form className="flex flex-col flex-1 overflow-hidden" onSubmit={handleSubmit}>
                <div className="space-y-4 px-6 py-2 overflow-auto flex-1 pb-28">
                  {[
                    { label: "Titre", key: "title", type: "text", placeholder: "Ex: Distribution repas chauds", required: true },
                    { label: "Description", key: "description", type: "text", placeholder: "Détails de la distribution" },
                    { label: "Date", key: "date", type: "date", placeholder: "", required: true },
                    { label: "Heure", key: "time", type: "text", placeholder: "Ex: 18h00" },
                    { label: "Lieu", key: "location", type: "text", placeholder: "Ex: Campus Luminy", required: true },
                    { label: "Repas disponibles", key: "meals", type: "number", placeholder: "50" },
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="text-sm font-medium text-foreground mb-1 block">{field.label}</label>
                      <input
                        type={field.type}
                        value={formData[field.key as keyof typeof formData]}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        placeholder={field.placeholder}
                        required={field.required}
                        className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 transition placeholder:text-muted-foreground/50"
                      />
                    </div>
                  ))}
                </div>
                <div className="sticky bottom-0 border-t border-border bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] backdrop-blur">
                  <Button type="submit" size="lg" disabled={submitting}
                    className="w-full rounded-2xl bg-primary text-primary-foreground shadow-lg hover:bg-primary/90">
                    {submitting ? <Loader2 className="animate-spin" /> : <Plus size={18} />}
                    {submitting ? "Création…" : "Créer la distribution"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Distribution;
