import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Heart, MessageCircle, Plus, X, Send, ImagePlus, Loader2, Trash2, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import StoriesBubbles from "@/components/StoriesBubbles";
import { createNotification } from "@/hooks/useNotifications";
import heroImg from "@/assets/hero-activities.jpg";

type BlogComment = {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profile_name?: string;
};

type BlogPost = {
  id: string;
  image: string;
  caption: string;
  likes: number;
  user_id?: string;
  author_name?: string;
  author_avatar?: string | null;
  created_at?: string;
};

const Blog = () => {
  const { user, profile, isAdmin, loading: authLoading } = useAuth();
  const [isBenevoleMember, setIsBenevoleMember] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const isBenevole = profile?.member_type === "benevole" || profile?.member_type === "both";
  const hasAccess = isBenevole || isAdmin || isBenevoleMember;
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [showUpload, setShowUpload] = useState(false);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [caption, setCaption] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(true);
  

  // Comments state
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentsMap, setCommentsMap] = useState<Record<string, BlogComment[]>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [sendingComment, setSendingComment] = useState<string | null>(null);

  // Check if user is approved member of "benevoles" room
  useEffect(() => {
    if (!user) { setCheckingAccess(false); return; }
    const checkBenevoleAccess = async () => {
      // Find the benevoles room
      const { data: room } = await supabase
        .from("chat_rooms")
        .select("id")
        .eq("slug", "benevoles")
        .maybeSingle();
      if (!room) { setCheckingAccess(false); return; }
      // Check membership
      const { data: membership } = await supabase
        .from("room_memberships")
        .select("status")
        .eq("room_id", room.id)
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle();
      setIsBenevoleMember(!!membership);
      setCheckingAccess(false);
    };
    checkBenevoleAccess();
  }, [user]);

  useEffect(() => {
    const fetchPosts = async () => {
      setLoadingPosts(true);
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, caption, image_url, created_at, user_id")
        .order("created_at", { ascending: false });

      if (error) {
        toast({ title: "Blog indisponible", description: "Impossible de charger les souvenirs.", variant: "destructive" });
        setLoadingPosts(false);
        return;
      }

      // Fetch author profiles
      const userIds = [...new Set((data ?? []).map(p => p.user_id))];
      const profileMap: Record<string, { name: string; avatar: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, nickname, avatar_url")
          .in("id", userIds);
        (profiles ?? []).forEach(p => {
          profileMap[p.id] = { name: p.nickname || p.full_name || "Membre", avatar: p.avatar_url };
        });
      }

      const formatted = (data ?? []).map((post) => ({
        id: post.id,
        image: post.image_url || heroImg,
        caption: post.caption?.trim() || "Souvenir partagé ✨",
        likes: 0,
        user_id: post.user_id,
        author_name: profileMap[post.user_id]?.name || "Membre",
        author_avatar: profileMap[post.user_id]?.avatar || null,
        created_at: post.created_at,
      }));

      setPosts(formatted);

      // Fetch comment counts
      const ids = formatted.map(p => p.id);
      if (ids.length > 0) {
        const { data: countData } = await supabase
          .from("blog_comments")
          .select("post_id")
          .in("post_id", ids);
        const counts: Record<string, number> = {};
        (countData ?? []).forEach(c => {
          counts[c.post_id] = (counts[c.post_id] || 0) + 1;
        });
        setCommentCounts(counts);
      }

      setLoadingPosts(false);
    };

    fetchPosts();
  }, []);


  useEffect(() => {
    if (!selectedFile) { setPreviewUrl(""); return; }
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const toggleLike = (id: string) => {
    setLikedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] ?? null);
  };

  const handleDeletePost = async (id: string) => {
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: "Impossible de supprimer ce post.", variant: "destructive" });
      return;
    }
    setPosts((prev) => prev.filter((p) => p.id !== id));
    toast({ title: "Post supprimé ✅" });
  };

  const resetForm = () => {
    setCaption("");
    setSelectedFile(null);
    setPreviewUrl("");
    setShowUpload(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      toast({ title: "Connexion requise", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      let imageUrl: string | null = null;
      if (selectedFile) {
        const ext = selectedFile.name.split(".").pop() || "jpg";
        const filePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("blog-images").upload(filePath, selectedFile, { upsert: false });
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from("blog-images").getPublicUrl(filePath);
        imageUrl = publicUrlData.publicUrl;
      }
      const { data, error } = await supabase
        .from("blog_posts")
        .insert({ user_id: user.id, caption: caption.trim() || null, image_url: imageUrl })
        .select("id, caption, image_url, created_at")
        .single();
      if (error) throw error;
      const { data: myProfile } = await supabase.from("profiles").select("full_name, nickname, avatar_url").eq("id", user.id).maybeSingle();
      setPosts((current) => [
        { id: data.id, image: data.image_url || heroImg, caption: data.caption?.trim() || "Souvenir partagé ✨", likes: 0, user_id: user.id, author_name: myProfile?.nickname || myProfile?.full_name || "Moi", author_avatar: myProfile?.avatar_url || null, created_at: data.created_at },
        ...current,
      ]);
      toast({ title: "Souvenir publié ✅" });
      resetForm();
    } catch {
      toast({ title: "Envoi impossible", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Comments logic
  const toggleComments = async (postId: string) => {
    const next = new Set(expandedComments);
    if (next.has(postId)) {
      next.delete(postId);
      setExpandedComments(next);
      return;
    }
    next.add(postId);
    setExpandedComments(next);
    // Fetch comments for this post
    if (!commentsMap[postId]) {
      const { data } = await supabase
        .from("blog_comments")
        .select("id, content, user_id, created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      const comments = data ?? [];
      // Fetch profile names
      const userIds = [...new Set(comments.map(c => c.user_id))];
      const profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, nickname")
          .in("id", userIds);
        (profiles ?? []).forEach(p => {
          profileMap[p.id] = p.nickname || p.full_name || "Utilisateur";
        });
      }

      setCommentsMap(prev => ({
        ...prev,
        [postId]: comments.map(c => ({ ...c, profile_name: profileMap[c.user_id] || "Utilisateur" })),
      }));
    }
  };

  const handleSendComment = async (postId: string) => {
    const content = (commentInputs[postId] || "").trim();
    if (!content || !user) return;
    setSendingComment(postId);
    const { data, error } = await supabase
      .from("blog_comments")
      .insert({ post_id: postId, user_id: user.id, content })
      .select("id, content, user_id, created_at")
      .single();
    if (error) {
      toast({ title: "Erreur", variant: "destructive" });
      setSendingComment(null);
      return;
    }
    // Get current user name
    const { data: profile } = await supabase.from("profiles").select("full_name, nickname").eq("id", user.id).maybeSingle();
    const name = profile?.nickname || profile?.full_name || "Moi";
    setCommentsMap(prev => ({
      ...prev,
      [postId]: [...(prev[postId] || []), { ...data, profile_name: name }],
    }));
    setCommentCounts(prev => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
    setCommentInputs(prev => ({ ...prev, [postId]: "" }));
    setSendingComment(null);

    // Send notification to post author
    const post = posts.find(p => p.id === postId);
    if (post && post.user_id && post.user_id !== user.id) {
      createNotification(post.user_id, "comment", "Nouveau commentaire", `${name} a commenté votre post`, "/blog");
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    await supabase.from("blog_comments").delete().eq("id", commentId);
    setCommentsMap(prev => ({
      ...prev,
      [postId]: (prev[postId] || []).filter(c => c.id !== commentId),
    }));
    setCommentCounts(prev => ({ ...prev, [postId]: Math.max(0, (prev[postId] || 1) - 1) }));
  };

  if (checkingAccess || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <Lock size={48} className="text-muted-foreground mb-4" />
        <h2 className="text-lg font-bold text-foreground mb-2">Accès réservé</h2>
        <p className="text-sm text-muted-foreground">Cette section est réservée aux bénévoles et administrateurs.<br/>Rejoignez le groupe Bénévole dans le Chat pour y accéder.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background safe-bottom">
      <PageHeader title="Aventure" subtitle="Nos plus beaux moments" />

      {/* Stories */}
      <StoriesBubbles />

      <main className="px-4 py-4 max-w-lg mx-auto space-y-4">
        {loadingPosts && posts.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Chargement des souvenirs…
          </div>
        )}

        {!loadingPosts && posts.length === 0 && (
          <div className="text-center py-12">
            <ImagePlus size={40} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Aucun souvenir pour le moment.</p>
            <p className="text-xs text-muted-foreground mt-1">Partagez vos plus beaux moments avec le bouton +</p>
          </div>
        )}

        {posts.map((post, i) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
          >
            {/* Author header */}
            <div className="flex items-center gap-2 p-3 pb-0">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-secondary flex-shrink-0">
                {post.author_avatar ? (
                  <img src={post.author_avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/20 text-primary text-xs font-bold">
                    {(post.author_name || "M")[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{post.author_name}</p>
                {post.created_at && (
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(post.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>
            </div>
            {post.image && <img src={post.image} alt={post.caption} loading="lazy" className="w-full object-cover" />}
            <div className="space-y-2 p-3">
              <p className="text-xs leading-relaxed text-foreground">{post.caption}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleLike(post.id)} className="flex items-center gap-1 text-xs">
                    <Heart size={14} className={likedPosts.has(post.id) ? "fill-destructive text-destructive" : "text-muted-foreground"} />
                    <span className="text-muted-foreground">{post.likes + (likedPosts.has(post.id) ? 1 : 0)}</span>
                  </button>
                  <button onClick={() => toggleComments(post.id)} className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MessageCircle size={14} />
                    <span>{commentCounts[post.id] || 0}</span>
                    {expandedComments.has(post.id) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>
                {user && (post.user_id === user.id || isAdmin) && (
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="flex items-center gap-1 rounded-lg bg-destructive px-2 py-1 text-[10px] font-bold text-destructive-foreground transition-colors hover:bg-destructive/90"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </div>

              {/* Comments section */}
              <AnimatePresence>
                {expandedComments.has(post.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border pt-2 mt-1 space-y-2">
                      {(commentsMap[post.id] || []).map((c) => (
                        <div key={c.id} className="flex items-start gap-2 group">
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px]">
                              <span className="font-semibold text-foreground">{c.profile_name}</span>{" "}
                              <span className="text-muted-foreground">{c.content}</span>
                            </p>
                            <p className="text-[9px] text-muted-foreground/60">
                              {new Date(c.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          {user && (c.user_id === user.id || isAdmin) && (
                            <button
                              onClick={() => handleDeleteComment(post.id, c.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 size={10} className="text-destructive" />
                            </button>
                          )}
                        </div>
                      ))}
                      {(commentsMap[post.id] || []).length === 0 && (
                        <p className="text-[11px] text-muted-foreground/60">Aucun commentaire</p>
                      )}
                      {user && (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            value={commentInputs[post.id] || ""}
                            onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && handleSendComment(post.id)}
                            placeholder="Commenter…"
                            className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-secondary text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-ring"
                          />
                          <button
                            onClick={() => handleSendComment(post.id)}
                            disabled={sendingComment === post.id}
                            className="shrink-0 text-primary disabled:opacity-50"
                          >
                            {sendingComment === post.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ))}
      </main>

      <button
        onClick={() => setShowUpload(true)}
        className="fixed right-4 bottom-24 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
      >
        <Plus size={24} />
      </button>

      <AnimatePresence>
        {showUpload && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/40" onClick={() => setShowUpload(false)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[80] flex max-h-[88dvh] flex-col rounded-t-3xl bg-background"
            >
              <div className="flex items-center justify-between p-6 pb-2">
                <h2 className="text-lg font-bold">Ajouter un souvenir</h2>
                <button type="button" onClick={() => setShowUpload(false)}><X size={20} className="text-muted-foreground" /></button>
              </div>
              <form className="flex flex-1 flex-col overflow-hidden" onSubmit={handleSubmit}>
                <div className="flex-1 space-y-4 overflow-auto px-6 py-2 pb-28">
                  <div className="rounded-2xl border border-dashed border-border bg-secondary/50 p-4">
                    <label className="mb-2 block text-sm font-medium text-foreground">Photo</label>
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground transition hover:bg-secondary">
                      <ImagePlus size={16} className="text-primary" />
                      {selectedFile ? selectedFile.name : "Choisir une image (optionnel)"}
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    </label>
                  </div>
                  {previewUrl && <img src={previewUrl} alt="Aperçu" className="w-full rounded-2xl border border-border object-cover" />}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Légende</label>
                    <textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Écris un message…"
                      className="min-h-[120px] w-full rounded-xl border border-input bg-secondary px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
                <div className="sticky bottom-0 border-t border-border bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] backdrop-blur">
                  <Button type="submit" size="lg" disabled={submitting} className="w-full rounded-2xl bg-accent text-accent-foreground shadow-lg hover:bg-accent/90">
                    {submitting ? <Loader2 className="animate-spin" /> : <Send size={18} />}
                    {submitting ? "Envoi…" : "Envoyer"}
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

export default Blog;
