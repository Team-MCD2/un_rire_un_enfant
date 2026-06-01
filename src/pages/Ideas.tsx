import { useEffect, useState } from "react";
import { Heart, MessageCircle, Plus, X, Send, ImagePlus, Loader2, Trash2, ChevronDown, ChevronUp, Lightbulb } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import PageHeader from "@/components/PageHeader";

interface IdeaPost {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  nickname?: string;
  avatar_url?: string;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  nickname?: string;
}

const Ideas = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<IdeaPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [content, setContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Comments state
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => setIsAdmin(Boolean(data)));
  }, [user]);

  useEffect(() => {
    if (!selectedFile) { setPreviewUrl(""); return; }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const fetchPosts = async () => {
    setLoading(true);
    const { data: postsData } = await supabase
      .from("idea_posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (!postsData || postsData.length === 0) { setPosts([]); setLoading(false); return; }

    const userIds = [...new Set(postsData.map((p) => p.user_id))];
    const [{ data: profiles }, { data: likes }, { data: commentCounts }] = await Promise.all([
      supabase.from("profiles").select("id, nickname, avatar_url").in("id", userIds),
      supabase.from("idea_likes").select("post_id, user_id"),
      supabase.from("idea_comments").select("post_id"),
    ]);

    const profileMap: Record<string, { id: string; nickname: string | null; avatar_url: string | null }> = {};
    (profiles ?? []).forEach((p) => { profileMap[p.id] = p; });

    const likeCounts: Record<string, number> = {};
    const myLikes = new Set<string>();
    (likes ?? []).forEach((l) => {
      likeCounts[l.post_id] = (likeCounts[l.post_id] || 0) + 1;
      if (user && l.user_id === user.id) myLikes.add(l.post_id);
    });

    const commCounts: Record<string, number> = {};
    (commentCounts ?? []).forEach((c) => {
      commCounts[c.post_id] = (commCounts[c.post_id] || 0) + 1;
    });

    setPosts(postsData.map((p) => ({
      ...p,
      nickname: profileMap[p.user_id]?.nickname || "Membre",
      avatar_url: profileMap[p.user_id]?.avatar_url,
      like_count: likeCounts[p.id] || 0,
      comment_count: commCounts[p.id] || 0,
      liked_by_me: myLikes.has(p.id),
    })));
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, [user]);

  const toggleLike = async (postId: string) => {
    if (!user) { toast({ title: "Connexion requise", variant: "destructive" }); return; }

    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    if (post.liked_by_me) {
      await supabase.from("idea_likes").delete().eq("post_id", postId).eq("user_id", user.id);
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, liked_by_me: false, like_count: p.like_count - 1 } : p));
    } else {
      await supabase.from("idea_likes").insert({ post_id: postId, user_id: user.id });
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, liked_by_me: true, like_count: p.like_count + 1 } : p));
    }
  };

  const toggleComments = async (postId: string) => {
    const next = new Set(expandedComments);
    if (next.has(postId)) {
      next.delete(postId);
    } else {
      next.add(postId);
      if (!comments[postId]) {
        const { data } = await supabase
          .from("idea_comments")
          .select("*")
          .eq("post_id", postId)
          .order("created_at", { ascending: true });

        if (data && data.length > 0) {
          const uids = [...new Set(data.map((c) => c.user_id))];
          const { data: profs } = await supabase.from("profiles").select("id, nickname").in("id", uids);
          const pmap: Record<string, string> = {};
          (profs ?? []).forEach((p) => { pmap[p.id] = p.nickname || "Membre"; });
          setComments((prev) => ({ ...prev, [postId]: data.map((c) => ({ ...c, nickname: pmap[c.user_id] || "Membre" })) }));
        } else {
          setComments((prev) => ({ ...prev, [postId]: [] }));
        }
      }
    }
    setExpandedComments(next);
  };

  const sendComment = async (postId: string) => {
    if (!user) return;
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    const { data, error } = await supabase.from("idea_comments")
      .insert({ post_id: postId, user_id: user.id, content: text })
      .select("*")
      .single();

    if (error) { toast({ title: "Erreur", variant: "destructive" }); return; }

    setComments((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), { ...data, nickname: "Moi" }],
    }));
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p));
    setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("idea_posts").delete().eq("id", id);
    if (error) { toast({ title: "Erreur", variant: "destructive" }); return; }
    setPosts((prev) => prev.filter((p) => p.id !== id));
    toast({ title: "Post supprimé ✅" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !content.trim()) return;
    setSubmitting(true);
    try {
      let imageUrl: string | null = null;
      if (selectedFile) {
        const ext = selectedFile.name.split(".").pop() || "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("idea-images").upload(path, selectedFile);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("idea-images").getPublicUrl(path);
        imageUrl = pub.publicUrl;
      }

      const { error } = await supabase.from("idea_posts").insert({
        user_id: user.id, content: content.trim(), image_url: imageUrl,
      });
      if (error) throw error;

      toast({ title: "Idée publiée 💡" });
      setContent("");
      setSelectedFile(null);
      setShowCreate(false);
      fetchPosts();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background safe-bottom">
      <PageHeader title="Idées" subtitle="Partagez vos inspirations" />

      <main className="px-4 py-4 max-w-lg mx-auto space-y-3">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12">
            <Lightbulb size={40} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Aucune idée pour le moment.</p>
            <p className="text-xs text-muted-foreground mt-1">Partagez vos inspirations avec le bouton +</p>
          </div>
        ) : (
          posts.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
            >
              {/* Author header */}
              <div className="flex items-center gap-3 px-4 pt-4 pb-2">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-primary/10 flex-shrink-0">
                  {post.avatar_url ? (
                    <img src={post.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-primary text-sm font-bold">
                      {(post.nickname || "M")[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{post.nickname}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(post.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {user && (post.user_id === user.id || isAdmin) && (
                  <button onClick={() => handleDelete(post.id)} className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {/* Content */}
              <p className="text-sm text-foreground px-4 pb-3 whitespace-pre-wrap">{post.content}</p>
              {post.image_url && (
                <img src={post.image_url} alt="" className="w-full object-cover max-h-80" loading="lazy" />
              )}

              {/* Actions */}
              <div className="flex items-center gap-4 px-4 py-3 border-t border-border">
                <button onClick={() => toggleLike(post.id)} className="flex items-center gap-1.5 text-xs">
                  <Heart size={16} className={post.liked_by_me ? "fill-destructive text-destructive" : "text-muted-foreground"} />
                  <span className="text-muted-foreground">{post.like_count}</span>
                </button>
                <button onClick={() => toggleComments(post.id)} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MessageCircle size={16} />
                  <span>{post.comment_count}</span>
                  {expandedComments.has(post.id) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </div>

              {/* Comments section */}
              <AnimatePresence>
                {expandedComments.has(post.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-border overflow-hidden"
                  >
                    <div className="px-4 py-3 space-y-2 max-h-60 overflow-auto">
                      {(comments[post.id] || []).length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-2">Aucun commentaire</p>
                      )}
                      {(comments[post.id] || []).map((c) => (
                        <div key={c.id} className="flex gap-2">
                          <span className="text-xs font-semibold text-foreground">{c.nickname}</span>
                          <span className="text-xs text-foreground flex-1">{c.content}</span>
                        </div>
                      ))}
                    </div>
                    {user && (
                      <div className="flex items-center gap-2 px-4 pb-3">
                        <input
                          value={commentInputs[post.id] || ""}
                          onChange={(e) => setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))}
                          placeholder="Commenter…"
                          className="flex-1 text-xs bg-secondary rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-ring"
                          maxLength={500}
                          onKeyDown={(e) => e.key === "Enter" && sendComment(post.id)}
                        />
                        <button onClick={() => sendComment(post.id)} className="text-primary">
                          <Send size={16} />
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </main>

      {/* FAB */}
      {user && (
        <button
          onClick={() => setShowCreate(true)}
          className="fixed right-4 bottom-24 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
        >
          <Plus size={24} />
        </button>
      )}

      {/* Create form drawer */}
      <AnimatePresence>
        {showCreate && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-foreground/40 z-50" onClick={() => setShowCreate(false)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[80] bg-background rounded-t-3xl flex flex-col max-h-[85dvh]"
            >
              <div className="flex items-center justify-between p-6 pb-2">
                <h2 className="text-lg font-bold">Nouvelle idée</h2>
                <button onClick={() => setShowCreate(false)}><X size={20} className="text-muted-foreground" /></button>
              </div>
              <form className="flex flex-col flex-1 overflow-hidden" onSubmit={handleSubmit}>
                <div className="space-y-4 px-6 py-2 overflow-auto flex-1 pb-28">
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Partagez votre idée, proposition, réflexion…"
                    className="w-full min-h-[120px] rounded-xl bg-secondary px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50"
                    maxLength={2000}
                    required
                  />
                  <div className="rounded-2xl border border-dashed border-border bg-secondary/50 p-4">
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground hover:bg-secondary transition">
                      <ImagePlus size={16} className="text-primary" />
                      {selectedFile ? selectedFile.name : "Ajouter une image (optionnel)"}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                  {previewUrl && <img src={previewUrl} alt="Aperçu" className="w-full rounded-2xl object-cover max-h-60" />}
                </div>
                <div className="sticky bottom-0 border-t border-border bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
                  <button
                    type="submit"
                    disabled={submitting || !content.trim()}
                    className="w-full rounded-2xl bg-primary text-primary-foreground py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 size={18} className="animate-spin" /> : <Lightbulb size={18} />}
                    {submitting ? "Publication…" : "Publier l'idée"}
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

export default Ideas;
