import { useState, useRef, useEffect } from "react";
import { Send, ChevronLeft, MessageCircle, UserPlus, Check, X, Loader2, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useNavigate, useParams } from "react-router-dom";
import { sendPushNotification } from "@/lib/notifications";

interface PrivateMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

interface Contact {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  lastMessage?: string;
  unread?: number;
}

interface ContactRequest {
  id: string;
  requester_id: string;
  target_id: string;
  status: string;
  created_at: string;
  requester_name?: string;
}

const PrivateChat = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { recipientId } = useParams<{ recipientId: string }>();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [input, setInput] = useState("");
  const [recipientProfile, setRecipientProfile] = useState<Contact | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<ContactRequest[]>([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [allProfiles, setAllProfiles] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [requestLoading, setRequestLoading] = useState<string | null>(null);

  // Check if admin
  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  // Fetch contacts
  useEffect(() => {
    if (!user) return;
    const fetchContacts = async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .neq("id", user.id);

      if (!profiles) return;
      setAllProfiles(profiles as Contact[]);

      const { data: allMessages } = await supabase
        .from("private_messages")
        .select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      // Get approved contact requests
      // @ts-expect-error table not typed
      const { data: approvedRequests } = await supabase
        .from("contact_requests")
        .select("*")
        .or(`requester_id.eq.${user.id},target_id.eq.${user.id}`)
        .eq("status", "approved");

      const approvedContactIds = new Set<string>();
      (approvedRequests || []).forEach((r: { requester_id: string; target_id: string; }) => {
        if (r.requester_id === user.id) approvedContactIds.add(r.target_id);
        else approvedContactIds.add(r.requester_id);
      });

      // Check admin status for bypassing
      const { data: roleData } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      const userIsAdmin = !!roleData;

      const contactMap = new Map<string, Contact>();

      profiles.forEach((p) => {
        const userMsgs = allMessages?.filter(
          (m) => (m.sender_id === p.id || m.receiver_id === p.id)
        );
        const lastMsg = userMsgs?.[0];
        const unread = userMsgs?.filter(
          (m) => m.sender_id === p.id && !m.read
        ).length || 0;

        // Show contact if: has messages, is target recipient, is approved contact, or user is admin
        const canShow = lastMsg || recipientId === p.id || approvedContactIds.has(p.id) || userIsAdmin;
        if (canShow) {
          contactMap.set(p.id, {
            ...p,
            lastMessage: lastMsg?.content,
            unread,
          });
        }
      });

      if (recipientId) {
        const recipient = profiles.find((p) => p.id === recipientId);
        if (recipient && !contactMap.has(recipientId)) {
          contactMap.set(recipientId, { ...recipient, unread: 0 });
        }
      }

      setContacts(Array.from(contactMap.values()));
    };
    fetchContacts();
  }, [user, recipientId]);

  // Fetch pending requests for current user
  useEffect(() => {
    if (!user) return;
    const fetchRequests = async () => {
      // @ts-expect-error table not typed
      const { data } = await supabase
        .from("contact_requests")
        .select("*")
        .eq("target_id", user.id)
        .eq("status", "pending");

      if (data) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name");
        const enriched = (data as ContactRequest[]).map((r) => ({
          ...r,
          requester_name: profiles?.find((p) => p.id === r.requester_id)?.full_name || "Membre",
        }));
        setPendingRequests(enriched);
      }
    };
    fetchRequests();

    // Subscribe to new requests
    const ch = supabase
      .channel("contact-requests-sub")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "contact_requests",
      }, () => fetchRequests())
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user]);

  // Fetch recipient profile
  useEffect(() => {
    if (!recipientId) { setRecipientProfile(null); return; }
    const r = contacts.find(c => c.id === recipientId);
    if (r) {
      setRecipientProfile(r);
    } else {
      supabase.from("profiles").select("id, full_name, avatar_url").eq("id", recipientId).single()
        .then(({ data }) => { if (data) setRecipientProfile(data as Contact); });
    }
  }, [recipientId, contacts]);

  // Fetch and subscribe to messages
  useEffect(() => {
    if (!recipientId || !user) { setMessages([]); return; }

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("private_messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${recipientId}),and(sender_id.eq.${recipientId},receiver_id.eq.${user.id})`
        )
        .order("created_at", { ascending: true })
        .limit(200);
      if (data) setMessages(data as PrivateMessage[]);

      await supabase
        .from("private_messages")
        .update({ read: true })
        .eq("sender_id", recipientId)
        .eq("receiver_id", user.id)
        .eq("read", false);
    };
    fetchMessages();

    const channel = supabase
      .channel(`dm-${[user.id, recipientId].sort().join("-")}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "private_messages",
      }, (payload) => {
        const msg = payload.new as PrivateMessage;
        if (
          (msg.sender_id === user.id && msg.receiver_id === recipientId) ||
          (msg.sender_id === recipientId && msg.receiver_id === user.id)
        ) {
          setMessages(prev => [...prev, msg]);
          if (msg.sender_id === recipientId) {
            supabase.from("private_messages").update({ read: true }).eq("id", msg.id);
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [recipientId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !recipientId || !user) return;
    const text = input.trim();
    setInput("");

    const { error } = await supabase.from("private_messages").insert({
      sender_id: user.id,
      receiver_id: recipientId,
      content: text,
    });

    if (error) {
      toast({ title: "Erreur", description: "Impossible d'envoyer", variant: "destructive" });
    } else {
      // Send push notification to recipient
      const senderName = profile?.full_name || profile?.nickname || "Quelqu'un";
      sendPushNotification(
        recipientId,
        `💬 ${senderName}`,
        text.length > 100 ? text.slice(0, 100) + "…" : text,
        `/messages/${user.id}`,
        "private-message"
      );
    }
  };

  const sendContactRequest = async (targetId: string) => {
    if (!user) return;
    setRequestLoading(targetId);
    // @ts-expect-error table not typed
    const { error } = await supabase.from("contact_requests").insert({
      requester_id: user.id,
      target_id: targetId,
    });
    if (error) {
      if (error.code === "23505") {
        toast({ title: "Demande déjà envoyée", description: "Attendez la réponse du membre." });
      } else {
        toast({ title: "Erreur", description: "Impossible d'envoyer la demande", variant: "destructive" });
      }
    } else {
      toast({ title: "Demande envoyée ✅", description: "Le membre sera notifié." });
    }
    setRequestLoading(null);
    setShowRequestModal(false);
  };

  const handleRequest = async (requestId: string, status: "approved" | "rejected") => {
    setRequestLoading(requestId);
    // @ts-expect-error table not typed
    const { error } = await supabase
      .from("contact_requests")
      // @ts-expect-error untyped
      .update({ status })
      .eq("id", requestId);
    if (error) {
      toast({ title: "Erreur", variant: "destructive" });
    } else {
      toast({ title: status === "approved" ? "Contact accepté ✅" : "Demande refusée" });
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
    }
    setRequestLoading(null);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <MessageCircle size={48} className="text-muted-foreground" />
        <p className="text-muted-foreground">Connectez-vous pour les messages privés.</p>
        <a href="/login" className="text-primary text-sm font-medium">Se connecter</a>
      </div>
    );
  }

  // Contact list view
  if (!recipientId) {
    const filteredProfiles = allProfiles.filter(p =>
      !contacts.find(c => c.id === p.id) &&
      (p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || false)
    );

    return (
      <div className="safe-screen bg-background safe-bottom">
        <header className="sticky top-0 z-40 glass safe-top px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/chat")} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
            <ChevronLeft size={18} className="text-foreground" />
          </button>
          <MessageCircle size={20} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground flex-1">Messages privés</h1>
          <button
            onClick={() => setShowRequestModal(true)}
            className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center"
          >
            <UserPlus size={16} className="text-primary" />
          </button>
        </header>

        <main className="px-4 py-4 max-w-lg mx-auto space-y-2">
          {/* Search bar */}
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={contactSearchQuery}
              onChange={(e) => setContactSearchQuery(e.target.value)}
              placeholder="Rechercher un membre..."
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 transition placeholder:text-muted-foreground/50"
            />
          </div>
          {/* Pending requests */}
          {pendingRequests.length > 0 && (
            <div className="space-y-2 mb-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Demandes de contact</h3>
              {pendingRequests.map((req) => (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-accent/5 border border-accent/20 rounded-2xl p-4 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-sm font-bold text-accent">
                    {(req.requester_name || "?")[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{req.requester_name}</p>
                    <p className="text-[10px] text-muted-foreground">Souhaite vous contacter</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleRequest(req.id, "approved")}
                      disabled={requestLoading === req.id}
                      className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50"
                    >
                      {requestLoading === req.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    </button>
                    <button
                      onClick={() => handleRequest(req.id, "rejected")}
                      disabled={requestLoading === req.id}
                      className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center disabled:opacity-50"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {(() => {
            // Filter contacts by search
            const filteredContacts = contactSearchQuery.trim()
              ? contacts.filter(c =>
                  (c.full_name || "").toLowerCase().includes(contactSearchQuery.toLowerCase())
                )
              : contacts;

            // Suggestions: profiles not in contacts, matching search
            const suggestions = contactSearchQuery.trim().length >= 2
              ? allProfiles.filter(p =>
                  !contacts.find(c => c.id === p.id) &&
                  ((p.full_name || "").toLowerCase().includes(contactSearchQuery.toLowerCase()))
                )
              : [];

            return (
              <>
                {filteredContacts.length === 0 && suggestions.length === 0 && pendingRequests.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-12">
                    {contactSearchQuery.trim() ? "Aucun résultat" : (
                      <>Aucune conversation privée pour l'instant.<br />
                      Appuyez sur <UserPlus size={14} className="inline" /> pour demander un contact.</>
                    )}
                  </p>
                ) : (
                  <>
                    {filteredContacts.map((c, i) => (
                      <motion.button
                        key={c.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => navigate(`/messages/${c.id}`)}
                        className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-3 hover:border-primary/30 hover:shadow-md transition-all text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                          {(c.full_name || "?")[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{c.full_name || "Utilisateur"}</p>
                          {c.lastMessage && (
                            <p className="text-xs text-muted-foreground truncate">{c.lastMessage}</p>
                          )}
                        </div>
                        {(c.unread ?? 0) > 0 && (
                          <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                            {c.unread}
                          </span>
                        )}
                      </motion.button>
                    ))}

                    {/* Suggestions section */}
                    {suggestions.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Suggestions</h3>
                        {suggestions.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => isAdmin ? navigate(`/messages/${p.id}`) : sendContactRequest(p.id)}
                            disabled={requestLoading === p.id}
                            className="w-full bg-card border border-dashed border-border rounded-2xl p-4 flex items-center gap-3 hover:border-primary/30 transition text-left disabled:opacity-50"
                          >
                            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-sm font-bold text-accent-foreground">
                              {(p.full_name || "?")[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{p.full_name || "Membre"}</p>
                              <p className="text-[10px] text-muted-foreground">Envoyer une demande de contact</p>
                            </div>
                            {requestLoading === p.id ? (
                              <Loader2 size={16} className="animate-spin text-muted-foreground" />
                            ) : (
                              <UserPlus size={16} className="text-primary" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            );
          })()}
        </main>

        {/* Request contact modal */}
        <AnimatePresence>
          {showRequestModal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-foreground/40 z-50"
                onClick={() => setShowRequestModal(false)}
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed inset-x-0 bottom-0 z-[80] bg-background rounded-t-3xl max-h-[70dvh] flex flex-col"
              >
                <div className="flex items-center justify-between p-5 pb-2">
                  <h2 className="text-base font-bold">Demander un contact</h2>
                  <button onClick={() => setShowRequestModal(false)}>
                    <X size={20} className="text-muted-foreground" />
                  </button>
                </div>
                <div className="px-5 pb-2">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un membre..."
                    className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 transition"
                  />
                </div>
                <div className="flex-1 overflow-auto px-5 py-2 space-y-2 pb-[env(safe-area-inset-bottom,1rem)]">
                  {filteredProfiles.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">Aucun membre trouvé</p>
                  ) : (
                    filteredProfiles.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => isAdmin ? navigate(`/messages/${p.id}`) : sendContactRequest(p.id)}
                        disabled={requestLoading === p.id}
                        className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-3 hover:border-primary/30 transition text-left disabled:opacity-50"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                          {(p.full_name || "?")[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{p.full_name || "Membre"}</p>
                        </div>
                        {requestLoading === p.id ? (
                          <Loader2 size={16} className="animate-spin text-muted-foreground" />
                        ) : isAdmin ? (
                          <MessageCircle size={16} className="text-primary" />
                        ) : (
                          <UserPlus size={16} className="text-primary" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Chat view
  return (
    <div className="safe-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 glass safe-top px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/messages")} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
          <ChevronLeft size={18} className="text-foreground" />
        </button>
        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
          {(recipientProfile?.full_name || "?")[0]}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-foreground truncate">
            {recipientProfile?.full_name || "Chargement..."}
          </h1>
          <p className="text-[10px] text-muted-foreground">Message privé</p>
        </div>
      </header>

      <main className="flex-1 overflow-auto px-4 py-4 space-y-3 max-w-lg mx-auto w-full">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            Démarrez la conversation ! 💬
          </p>
        )}
        {messages.map((msg) => {
          const isMe = msg.sender_id === user.id;
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div className="max-w-[75%]">
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isMe
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-secondary text-foreground rounded-bl-md"
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 block px-1">
                  {new Date(msg.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </motion.div>
          );
        })}
        <div ref={bottomRef} />
      </main>

      <div className="sticky bottom-0 glass px-4 py-3 safe-bottom">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Écrire un message..."
            className="flex-1 px-4 py-3 rounded-xl bg-secondary text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 transition"
          />
          <button
            onClick={sendMessage}
            className="w-11 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivateChat;