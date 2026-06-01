import { useEffect, useState, useRef } from "react";
import { Plus, X, Send, ImagePlus, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface Story {
  id: string;
  user_id: string;
  image_url: string | null;
  caption: string | null;
  created_at: string;
  nickname?: string;
  avatar_url?: string;
}

const StoriesBubbles = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [viewingStory, setViewingStory] = useState<Story | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const fetchStories = async () => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("stories")
        .select("*")
        .gte("created_at", twentyFourHoursAgo)
        .order("created_at", { ascending: false });

      if (!data || data.length === 0) { setStories([]); return; }

      // Fetch profiles for story authors
      const userIds = [...new Set(data.map((s) => s.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url")
        .in("id", userIds);

      const profileMap: Record<string, { nickname: string | null; avatar_url: string | null }> = {};
      (profiles ?? []).forEach((p) => { profileMap[p.id] = p; });

      setStories(data.map((s) => ({
        ...s,
        nickname: profileMap[s.user_id]?.nickname || "Membre",
        avatar_url: profileMap[s.user_id]?.avatar_url,
      })));
    };
    fetchStories();
  }, [showCreate]);

  useEffect(() => {
    if (!selectedFile) { setPreviewUrl(""); return; }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  // Auto-progress when viewing a story
  useEffect(() => {
    if (!viewingStory) { setProgress(0); return; }
    setProgress(0);
    const duration = 5000; // 5 seconds
    const interval = 50;
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed += interval;
      setProgress((elapsed / duration) * 100);
      if (elapsed >= duration) {
        clearInterval(timerRef.current);
        setViewingStory(null);
      }
    }, interval);
    return () => clearInterval(timerRef.current);
  }, [viewingStory]);

  // Group stories by user, show latest per user
  const groupedByUser = stories.reduce<Record<string, Story>>((acc, s) => {
    if (!acc[s.user_id] || new Date(s.created_at) > new Date(acc[s.user_id].created_at)) {
      acc[s.user_id] = s;
    }
    return acc;
  }, {});
  const uniqueStories = Object.values(groupedByUser);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || (!selectedFile && !caption.trim())) return;
    setSubmitting(true);

    try {
      let imageUrl: string | null = null;
      if (selectedFile) {
        const ext = selectedFile.name.split(".").pop() || "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("stories").upload(path, selectedFile);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("stories").getPublicUrl(path);
        imageUrl = pub.publicUrl;
      }

      const { error } = await supabase.from("stories").insert({
        user_id: user.id,
        image_url: imageUrl,
        caption: caption.trim() || null,
      });
      if (error) throw error;

      toast({ title: "Story publiée ✨" });
      setCaption("");
      setSelectedFile(null);
      setShowCreate(false);
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Stories row */}
      <div ref={scrollRef} className="flex items-center gap-3 px-4 py-3 overflow-x-auto no-scrollbar">
        {/* Add story button */}
        {user && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex flex-col items-center gap-1 flex-shrink-0"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-dashed border-primary/40 flex items-center justify-center">
              <Plus size={20} className="text-primary" />
            </div>
            <span className="text-[10px] text-muted-foreground font-medium">Ma story</span>
          </button>
        )}

        {/* Existing stories */}
        {uniqueStories.map((story) => (
          <button
            key={story.user_id}
            onClick={() => setViewingStory(story)}
            className="flex flex-col items-center gap-1 flex-shrink-0"
          >
            <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-primary to-accent">
              <div className="w-full h-full rounded-full overflow-hidden bg-background border-2 border-background">
                {story.avatar_url ? (
                  <img src={story.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
                    {(story.nickname || "M")[0].toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground font-medium truncate max-w-16">
              {story.user_id === user?.id ? "Moi" : story.nickname}
            </span>
          </button>
        ))}
      </div>

      {/* View story fullscreen */}
      <AnimatePresence>
        {viewingStory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col"
            onClick={() => setViewingStory(null)}
          >
            {/* Progress bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-white/20 z-10">
              <div className="h-full bg-white transition-all duration-75" style={{ width: `${progress}%` }} />
            </div>

            {/* Header */}
            <div className="absolute top-6 left-4 right-4 z-10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-white/20">
                {viewingStory.avatar_url ? (
                  <img src={viewingStory.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                    {(viewingStory.nickname || "M")[0].toUpperCase()}
                  </div>
                )}
              </div>
              <span className="text-white text-sm font-medium">{viewingStory.nickname}</span>
              <span className="text-white/50 text-xs">
                {new Date(viewingStory.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <button onClick={() => setViewingStory(null)} className="ml-auto">
                <X size={24} className="text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 flex items-center justify-center">
              {viewingStory.image_url ? (
                <img src={viewingStory.image_url} alt="" className="max-w-full max-h-full object-contain" />
              ) : (
                <p className="text-white text-xl font-semibold px-8 text-center">{viewingStory.caption}</p>
              )}
            </div>

            {/* Caption overlay */}
            {viewingStory.image_url && viewingStory.caption && (
              <div className="absolute bottom-12 left-4 right-4 z-10">
                <p className="text-white text-sm bg-black/40 rounded-xl px-4 py-2 backdrop-blur">{viewingStory.caption}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create story drawer */}
      <AnimatePresence>
        {showCreate && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-foreground/40 z-[90]" onClick={() => setShowCreate(false)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[95] bg-background rounded-t-3xl flex flex-col max-h-[80dvh]"
            >
              <div className="flex items-center justify-between p-6 pb-2">
                <h2 className="text-lg font-bold">Nouvelle story</h2>
                <button onClick={() => setShowCreate(false)}><X size={20} className="text-muted-foreground" /></button>
              </div>
              <form className="flex flex-col flex-1 overflow-hidden" onSubmit={handleSubmit}>
                <div className="space-y-4 px-6 py-2 overflow-auto flex-1 pb-28">
                  <div className="rounded-2xl border border-dashed border-border bg-secondary/50 p-4">
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground hover:bg-secondary transition">
                      <ImagePlus size={16} className="text-primary" />
                      {selectedFile ? selectedFile.name : "Photo ou vidéo"}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                  {previewUrl && <img src={previewUrl} alt="Aperçu" className="w-full rounded-2xl object-cover max-h-60" />}
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Ajouter un texte…"
                    className="w-full min-h-[80px] rounded-xl bg-secondary px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50"
                    maxLength={500}
                  />
                </div>
                <div className="sticky bottom-0 border-t border-border bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
                  <button
                    type="submit"
                    disabled={submitting || (!selectedFile && !caption.trim())}
                    className="w-full rounded-2xl bg-primary text-primary-foreground py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    {submitting ? "Envoi…" : "Publier"}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default StoriesBubbles;
