import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Lock, Users, ChevronLeft, Bot, MessageCircle, Mic, Square, Loader2, Trash2, Pencil, Reply, Pin, X, Check, SmilePlus, UserPlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";

interface ChatRoom {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
}

interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string;
  user_name: string;
  content: string;
  is_bot: boolean;
  created_at: string;
  audio_url?: string | null;
  reply_to_id?: string | null;
  edited_at?: string | null;
  is_pinned?: boolean;
}

interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

type MembershipStatus = "pending" | "approved" | "rejected" | null;

const BOT_NAME = "Nino 🤖";
const BOT_KEYWORDS = ["horaires", "horaire", "prix", "tarif", "contact", "adresse", "heure", "ferme", "ouvre", "repas", "inscription", "bénévole", "aide", "info", "information"];
const ADMIN_EMAILS = ["hterbah31100@gmail.com", "admin31@rirepour1enfant.app"];

const BOT_ENABLED_SLUGS = ["benevoles", "repas-etudiants"];
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "🔥"];

const Chat = () => {
  const { user, profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [membership, setMembership] = useState<MembershipStatus>(null);
  const [loadingMembership, setLoadingMembership] = useState(false);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Unread counts per room
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [unreadPrivate, setUnreadPrivate] = useState(0);

  // Message features
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [editInput, setEditInput] = useState("");
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [roomMembers, setRoomMembers] = useState<{ id: string; full_name: string | null; nickname: string | null; avatar_url: string | null; bio: string | null; phone: string | null; member_type: string; }[]>([]);
  const [selectedMember, setSelectedMember] = useState<{ id: string; full_name: string | null; nickname: string | null; avatar_url: string | null; bio: string | null; phone: string | null; member_type: string; } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch rooms
  useEffect(() => {
    const fetchRooms = async () => {
      const { data } = await supabase.from("chat_rooms").select("*").order("created_at");
      if (data) setRooms(data as ChatRoom[]);
    };
    fetchRooms();
  }, []);

  // Fetch unread counts for room list
  useEffect(() => {
    if (!user || !rooms.length) return;

    const fetchUnread = async () => {
      const { data: memberships } = await supabase
        .from("room_memberships")
        .select("room_id")
        .eq("user_id", user.id)
        .eq("status", "approved");

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      const approvedRoomIds = roleData
        ? rooms.map(r => r.id)
        : (memberships?.map((m) => m.room_id) || []);

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const counts: Record<string, number> = {};

      for (const roomId of approvedRoomIds) {
        const { count } = await supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .eq("room_id", roomId)
          .neq("user_id", user.id)
          .gte("created_at", since);
        counts[roomId] = count || 0;
      }
      setUnreadCounts(counts);

      const { count: privCount } = await supabase
        .from("private_messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("read", false);
      setUnreadPrivate(privCount || 0);
    };

    fetchUnread();
  }, [user, rooms]);

  // Presence tracking
  useEffect(() => {
    if (!selectedRoom || membership !== "approved" || !user) return;

    const presenceChannel = supabase.channel(`presence-${selectedRoom.id}`, {
      config: { presence: { key: user.id } },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const ids = new Set<string>(Object.keys(state));
        setOnlineUsers(ids);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            user_id: user.id,
            user_name: profile?.full_name || user.email?.split("@")[0] || "Anonyme",
          });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [selectedRoom, membership, user, profile]);

  // Fetch membership status when room selected
  useEffect(() => {
    if (!selectedRoom || !user) { setMembership(null); return; }
    const checkMembership = async () => {
      setLoadingMembership(true);
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (roleData) {
        setMembership("approved");
        setLoadingMembership(false);
        return;
      }
      const { data } = await supabase
        .from("room_memberships")
        .select("status")
        .eq("room_id", selectedRoom.id)
        .eq("user_id", user.id)
        .maybeSingle();
      setMembership((data?.status as MembershipStatus) ?? null);
      setLoadingMembership(false);
    };
    checkMembership();
  }, [selectedRoom, user]);

  // Fetch room members when approved
  useEffect(() => {
    if (!selectedRoom || membership !== "approved") { setRoomMembers([]); return; }
    const fetchMembers = async () => {
      // Get approved member user_ids
      const { data: memberships } = await supabase
        .from("room_memberships")
        .select("user_id")
        .eq("room_id", selectedRoom.id)
        .eq("status", "approved");
      if (!memberships || memberships.length === 0) { setRoomMembers([]); return; }
      const memberIds = memberships.map((m) => m.user_id);
      // Fetch profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, nickname, avatar_url, bio, phone, member_type")
        .in("id", memberIds);
      if (profiles) setRoomMembers(profiles);
    };
    fetchMembers();
  }, [selectedRoom, membership]);

  // Fetch messages + reactions when approved
  useEffect(() => {
    if (!selectedRoom || membership !== "approved") { setMessages([]); setReactions({}); return; }
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("room_id", selectedRoom.id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (data) setMessages(data as ChatMessage[]);

      // Fetch reactions for all messages in this room
      if (data && data.length > 0) {
        const msgIds = data.map((m) => m.id);
        const { data: rxns } = await supabase
          .from("message_reactions")
          .select("*")
          .in("message_id", msgIds);
        if (rxns) {
          const grouped: Record<string, Reaction[]> = {};
          rxns.forEach((r: Reaction) => {
            if (!grouped[r.message_id]) grouped[r.message_id] = [];
            grouped[r.message_id].push(r);
          });
          setReactions(grouped);
        }
      }
    };
    fetchMessages();

    const channel = supabase
      .channel(`room-${selectedRoom.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `room_id=eq.${selectedRoom.id}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as ChatMessage]);
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "chat_messages",
        filter: `room_id=eq.${selectedRoom.id}`,
      }, (payload) => {
        setMessages((prev) => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } as ChatMessage : m));
      })
      .on("postgres_changes", {
        event: "DELETE",
        schema: "public",
        table: "chat_messages",
        filter: `room_id=eq.${selectedRoom.id}`,
      }, (payload) => {
        setMessages((prev) => prev.filter(m => m.id !== (payload.old as {id: string}).id));
      })
      .subscribe();

    // Reactions realtime
    const rxnChannel = supabase
      .channel(`reactions-${selectedRoom.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "message_reactions",
      }, (payload) => {
        if (payload.eventType === "INSERT") {
          const r = payload.new as Reaction;
          setReactions(prev => ({
            ...prev,
            [r.message_id]: [...(prev[r.message_id] || []), r],
          }));
        } else if (payload.eventType === "DELETE") {
          const r = payload.old as Reaction;
          setReactions(prev => ({
            ...prev,
            [r.message_id]: (prev[r.message_id] || []).filter(x => x.id !== r.id),
          }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(rxnChannel);
    };
  }, [selectedRoom, membership]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isBotTyping]);

  const requestAccess = async () => {
    if (!selectedRoom || !user) return;
    const { error } = await supabase.from("room_memberships").insert({
      room_id: selectedRoom.id,
      user_id: user.id,
      status: "pending",
    });
    if (error) {
      toast({ title: "Erreur", description: "Impossible de demander l'accès", variant: "destructive" });
    } else {
      setMembership("pending");
      toast({ title: "Demande envoyée", description: "Un administrateur validera votre accès." });
    }
  };

  const shouldBotRespond = useCallback((text: string): boolean => {
    if (!selectedRoom || !BOT_ENABLED_SLUGS.includes(selectedRoom.slug)) return false;
    const lower = text.toLowerCase();
    if (lower.includes("?")) return true;
    return BOT_KEYWORDS.some((kw) => lower.includes(kw));
  }, [selectedRoom]);

  const triggerBot = useCallback(async (userMessage: string) => {
    if (!selectedRoom) return;
    setIsBotTyping(true);
    try {
      const { data: instructions } = await supabase
        .from("bot_instructions")
        .select("instruction");

      const instructionsText = instructions?.map((i) => i.instruction).join("\n") || "";

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: userMessage }],
          botInstructions: instructionsText,
          roomContext: selectedRoom.slug,
          roomId: selectedRoom.id,
        }),
      });

      if (!resp.ok) throw new Error("Bot error");
    } catch (e) {
      console.error("Bot error:", e);
    } finally {
      setIsBotTyping(false);
    }
  }, [selectedRoom]);

  const sendMessage = async () => {
    if (!input.trim() || !selectedRoom || !user) return;
    const text = input.trim();
    setInput("");

    const userName = profile?.full_name || user.email?.split("@")[0] || "Anonyme";

    const insertData = {
      room_id: selectedRoom.id,
      user_id: user.id,
      user_name: userName,
      content: text,
      is_bot: false,
      ...(replyTo ? { reply_to_id: replyTo.id } : {})
    };

    const { error } = await supabase.from("chat_messages").insert(insertData);
    setReplyTo(null);

    if (error) {
      toast({ title: "Erreur", description: "Impossible d'envoyer le message", variant: "destructive" });
      return;
    }

    const isAdminUser = ADMIN_EMAILS.includes(user.email || "");
    if (!isAdminUser && shouldBotRespond(text)) {
      setTimeout(() => triggerBot(text), 1000);
    }
  };

  // Edit message
  const saveEdit = async () => {
    if (!editingMsg || !editInput.trim()) return;
    await supabase
      .from("chat_messages")
      .update({ content: editInput.trim(), edited_at: new Date().toISOString() })
      .eq("id", editingMsg.id);
    setEditingMsg(null);
    setEditInput("");
  };

  // Delete message
  const deleteMessage = async (msgId: string) => {
    await supabase.from("chat_messages").delete().eq("id", msgId);
    setActiveMenu(null);
  };

  // Pin/unpin message
  const togglePin = async (msg: ChatMessage) => {
    await supabase
      .from("chat_messages")
      .update({ is_pinned: !msg.is_pinned })
      .eq("id", msg.id);
    setActiveMenu(null);
  };

  // Toggle reaction
  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const existing = (reactions[messageId] || []).find(r => r.user_id === user.id && r.emoji === emoji);
    if (existing) {
      await supabase.from("message_reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("message_reactions").insert({
        message_id: messageId,
        user_id: user.id,
        emoji,
      });
    }
    setShowReactions(null);
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await uploadVoiceMessage(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      toast({ title: "Erreur", description: "Impossible d'accéder au microphone", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const uploadVoiceMessage = async (blob: Blob) => {
    if (!selectedRoom || !user) return;
    setUploadingAudio(true);

    const fileName = `${selectedRoom.id}/${user.id}-${Date.now()}.webm`;
    const { error: uploadError } = await supabase.storage
      .from("voice-messages")
      .upload(fileName, blob, { contentType: "audio/webm" });

    if (uploadError) {
      toast({ title: "Erreur", description: "Échec de l'upload audio", variant: "destructive" });
      setUploadingAudio(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("voice-messages").getPublicUrl(fileName);
    const userName = profile?.full_name || user.email?.split("@")[0] || "Anonyme";

    await supabase.from("chat_messages").insert({
      room_id: selectedRoom.id,
      user_id: user.id,
      user_name: userName,
      content: "🎤 Message vocal",
      is_bot: false,
      audio_url: urlData.publicUrl,
    });

    setUploadingAudio(false);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;


  const handleUserClick = (userId: string) => {
    if (userId === user?.id) return;
    navigate(`/messages/${userId}`);
  };

  const sendFriendRequest = async (targetId: string) => {
    if (!user) return;
    // @ts-expect-error table not typed
    const { error } = await supabase.from("contact_requests").insert({
      requester_id: user.id,
      target_id: targetId,
    });
    if (error) {
      if (error.code === "23505") {
        toast({ title: "Demande déjà envoyée" });
      } else {
        toast({ title: "Erreur", variant: "destructive" });
      }
    } else {
      toast({ title: "Demande d'ami envoyée ✅" });
    }
  };

  // Get pinned messages
  const pinnedMessages = messages.filter(m => m.is_pinned);

  // Find reply-to message
  const getReplyMessage = (replyId: string | null | undefined) => {
    if (!replyId) return null;
    return messages.find(m => m.id === replyId) || null;
  };

  // Group reactions by emoji
  const getGroupedReactions = (messageId: string) => {
    const msgReactions = reactions[messageId] || [];
    const grouped: Record<string, { count: number; userReacted: boolean }> = {};
    msgReactions.forEach(r => {
      if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, userReacted: false };
      grouped[r.emoji].count++;
      if (r.user_id === user?.id) grouped[r.emoji].userReacted = true;
    });
    return grouped;
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <Lock size={48} className="text-muted-foreground" />
        <p className="text-muted-foreground">Connectez-vous pour accéder aux salons.</p>
        <a href="/login" className="text-primary text-sm font-medium">Se connecter</a>
      </div>
    );
  }

  // Room list view
  if (!selectedRoom) {
    return (
      <div className="min-h-screen bg-background safe-bottom">
        <PageHeader title="Chat" subtitle="Choisissez un salon" />
        <main className="px-4 py-4 max-w-lg mx-auto space-y-3">
          {/* Private messages button */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => navigate("/messages")}
            className="w-full bg-card border border-primary/20 rounded-2xl p-5 flex items-center gap-4 hover:border-primary/40 hover:shadow-md transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <MessageCircle size={22} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-foreground">Messages privés</h3>
              <p className="text-xs text-muted-foreground">Discutez en privé avec un membre</p>
            </div>
            {unreadPrivate > 0 && (
              <span className="w-6 h-6 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                {unreadPrivate > 99 ? "99+" : unreadPrivate}
              </span>
            )}
          </motion.button>

          <div className="h-px bg-border my-2" />

          {rooms.map((room, i) => (
            <motion.button
              key={room.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (i + 1) * 0.08 }}
              onClick={() => { setSelectedRoom(room); setUnreadCounts(prev => ({ ...prev, [room.id]: 0 })); }}
              className="w-full bg-card border border-border rounded-2xl p-5 flex items-center gap-4 hover:border-primary/30 hover:shadow-md transition-all text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">
                {room.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-foreground">{room.name}</h3>
                <p className="text-xs text-muted-foreground truncate">{room.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {(unreadCounts[room.id] || 0) > 0 && (
                  <span className="w-6 h-6 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                    {unreadCounts[room.id] > 99 ? "99+" : unreadCounts[room.id]}
                  </span>
                )}
              </div>
            </motion.button>
          ))}
        </main>
      </div>
    );
  }

  // Room chat view
  return (
    <div className="safe-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 glass safe-top px-4 py-3 flex items-center gap-3">
        <button onClick={() => { setSelectedRoom(null); setReplyTo(null); setEditingMsg(null); }} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
          <ChevronLeft size={18} className="text-foreground" />
        </button>
        <button
          onClick={() => membership === "approved" && setShowMembers(!showMembers)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left active:opacity-70 touch-manipulation"
        >
          <span className="text-xl">{selectedRoom.icon}</span>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-foreground truncate">{selectedRoom.name}</h1>
            <p className="text-[10px] text-muted-foreground truncate">
              {membership === "approved"
                ? `${roomMembers.length} membre${roomMembers.length > 1 ? "s" : ""} · Appuyez pour voir`
                : selectedRoom.description}
            </p>
          </div>
          {membership === "approved" && (
            <Users size={16} className="text-primary shrink-0" />
          )}
        </button>
      </header>

      {/* Members panel */}
      <AnimatePresence>
        {showMembers && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border bg-card"
          >
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-foreground">{roomMembers.length} membre{roomMembers.length > 1 ? "s" : ""}</p>
                <button onClick={() => setShowMembers(false)} className="text-muted-foreground">
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-2 max-h-48 overflow-auto">
                {roomMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedMember(member)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left touch-manipulation active:opacity-70"
                    >
                      <div className="relative shrink-0">
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {(member.nickname || member.full_name || "?")[0]?.toUpperCase()}
                          </div>
                        )}
                        {onlineUsers.has(member.id) && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-card" />
                        )}
                      </div>
                      <p className="text-sm text-foreground flex-1 truncate">
                        {member.nickname || member.full_name || "Membre"}
                        {member.id === user?.id && <span className="text-muted-foreground text-xs ml-1">(vous)</span>}
                      </p>
                    </button>
                    {member.id !== user?.id && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => sendFriendRequest(member.id)}
                          className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center hover:bg-accent/20 transition"
                          title="Ajouter en ami"
                        >
                          <UserPlus size={13} className="text-accent-foreground" />
                        </button>
                        <button
                          onClick={() => navigate(`/messages/${member.id}`)}
                          className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition"
                          title="Envoyer un message"
                        >
                          <MessageCircle size={13} className="text-primary" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={async () => {
                              if (!selectedRoom) return;
                              const { error } = await supabase
                                .from("room_memberships")
                                .delete()
                                .eq("room_id", selectedRoom.id)
                                .eq("user_id", member.id);
                              if (error) {
                                toast({ title: "Erreur", variant: "destructive" });
                              } else {
                                setRoomMembers(prev => prev.filter(m => m.id !== member.id));
                                toast({ title: "Membre exclu du groupe ✅" });
                              }
                            }}
                            className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition"
                            title="Exclure du groupe"
                          >
                            <Trash2 size={13} className="text-destructive" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pinned messages banner */}
      {pinnedMessages.length > 0 && membership === "approved" && (
        <div className="px-4 py-2 bg-accent/10 border-b border-accent/20 flex items-center gap-2">
          <Pin size={12} className="text-accent shrink-0" />
          <p className="text-xs text-foreground truncate flex-1">
            📌 {pinnedMessages[pinnedMessages.length - 1].content}
          </p>
          <span className="text-[10px] text-muted-foreground shrink-0">{pinnedMessages.length} épinglé{pinnedMessages.length > 1 ? "s" : ""}</span>
        </div>
      )}

      {/* Access states */}
      {loadingMembership ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : membership !== "approved" ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <Lock size={40} className="text-muted-foreground" />
          {membership === "pending" ? (
            <>
              <p className="text-muted-foreground text-center text-sm">
                Votre demande d'accès est en attente de validation par un administrateur.
              </p>
              <div className="px-4 py-2 rounded-xl bg-accent/10 text-accent text-xs font-medium">
                ⏳ En attente
              </div>
            </>
          ) : membership === "rejected" ? (
            <p className="text-destructive text-center text-sm">Votre demande a été refusée.</p>
          ) : (
            <>
              <p className="text-muted-foreground text-center text-sm">
                Ce salon est réservé aux membres approuvés.
              </p>
              <button
                onClick={requestAccess}
                className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition"
              >
                Demander l'accès
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Messages */}
          <main className="flex-1 overflow-auto px-4 py-4 space-y-3 max-w-lg mx-auto w-full" onClick={() => { setActiveMenu(null); setShowReactions(null); }}>
            {messages.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                Aucun message pour l'instant. Soyez le premier ! 🎉
              </p>
            )}
            {messages.map((msg) => {
              const isMe = msg.user_id === user.id;
              const isOnline = onlineUsers.has(msg.user_id);
              const replyMsg = getReplyMessage(msg.reply_to_id);
              const grouped = getGroupedReactions(msg.id);
              const canModify = isMe || isAdmin;

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isMe ? "justify-end" : "justify-start"} relative group`}
                >
                  <div className={`max-w-[80%] ${isMe ? "order-2" : ""}`}>
                    {/* Pinned indicator */}
                    {msg.is_pinned && (
                      <div className="flex items-center gap-1 mb-0.5 px-1">
                        <Pin size={10} className="text-accent" />
                        <span className="text-[10px] text-accent font-medium">Épinglé</span>
                      </div>
                    )}

                    {!isMe && (
                      <button
                        onClick={() => !msg.is_bot && handleUserClick(msg.user_id)}
                        className={`flex items-center gap-2 mb-1 ${!msg.is_bot ? "cursor-pointer hover:opacity-70" : ""}`}
                        disabled={msg.is_bot}
                      >
                        {msg.is_bot ? (
                          <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
                            <Bot size={12} className="text-accent" />
                          </div>
                        ) : (
                          <div className="relative">
                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                              {msg.user_name[0]}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${
                                isOnline ? "bg-green-500" : "bg-red-400"
                              }`}
                            />
                          </div>
                        )}
                        <span className={`text-xs font-medium ${msg.is_bot ? "text-accent" : "text-foreground"}`}>
                          {msg.user_name}
                        </span>
                      </button>
                    )}

                    {/* Reply preview */}
                    {replyMsg && (
                      <div className="px-3 py-1.5 mb-1 rounded-lg bg-muted/50 border-l-2 border-primary/40 text-[11px] text-muted-foreground truncate">
                        <span className="font-medium text-foreground/70">{replyMsg.user_name}</span>: {replyMsg.content}
                      </div>
                    )}

                    {/* Message bubble */}
                    <div
                      className={`relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        isMe
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : msg.is_bot
                          ? "bg-accent/10 text-foreground rounded-bl-md border border-accent/20"
                          : "bg-secondary text-foreground rounded-bl-md"
                      }`}
                      onTouchStart={() => {
                        const timer = setTimeout(() => setActiveMenu(msg.id), 500);
                        (window as unknown as { __longPressTimer: NodeJS.Timeout }).__longPressTimer = timer;
                      }}
                      onTouchEnd={() => clearTimeout((window as unknown as { __longPressTimer: NodeJS.Timeout }).__longPressTimer)}
                      onContextMenu={(e) => { e.preventDefault(); setActiveMenu(msg.id); }}
                    >
                      {msg.audio_url ? (
                        <div className="flex items-center gap-2">
                          <Mic size={14} />
                          <audio controls src={msg.audio_url} className="h-8 max-w-[200px]" preload="metadata" />
                        </div>
                      ) : (
                        editingMsg?.id === msg.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              value={editInput}
                              onChange={(e) => setEditInput(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                              className="flex-1 bg-transparent outline-none text-sm"
                              autoFocus
                            />
                            <button onClick={saveEdit} className="shrink-0"><Check size={14} /></button>
                            <button onClick={() => setEditingMsg(null)} className="shrink-0"><X size={14} /></button>
                          </div>
                        ) : (
                          <span>{msg.content}</span>
                        )
                      )}
                      {msg.edited_at && !editingMsg && (
                        <span className="text-[9px] opacity-60 ml-1">(modifié)</span>
                      )}
                    </div>

                    {/* Reactions display */}
                    {Object.keys(grouped).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 px-1">
                        {Object.entries(grouped).map(([emoji, data]) => (
                          <button
                            key={emoji}
                            onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, emoji); }}
                            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition ${
                              data.userReacted 
                                ? "bg-primary/10 border-primary/30" 
                                : "bg-secondary border-border hover:border-primary/20"
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className="text-[10px] text-muted-foreground">{data.count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Time + action buttons */}
                    <div className="flex items-center gap-1 mt-0.5 px-1">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(msg.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {/* Inline quick actions (visible on hover/tap) */}
                      <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowReactions(showReactions === msg.id ? null : msg.id); }}
                          className="w-5 h-5 rounded-full bg-secondary/80 flex items-center justify-center hover:bg-secondary"
                          title="Réagir"
                        >
                          <SmilePlus size={10} className="text-muted-foreground" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setReplyTo(msg); inputRef.current?.focus(); }}
                          className="w-5 h-5 rounded-full bg-secondary/80 flex items-center justify-center hover:bg-secondary"
                          title="Répondre"
                        >
                          <Reply size={10} className="text-muted-foreground" />
                        </button>
                        {canModify && (
                          <>
                            {isMe && !msg.audio_url && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingMsg(msg); setEditInput(msg.content); }}
                                className="w-5 h-5 rounded-full bg-secondary/80 flex items-center justify-center hover:bg-secondary"
                                title="Modifier"
                              >
                                <Pencil size={10} className="text-muted-foreground" />
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteMessage(msg.id); }}
                              className="w-5 h-5 rounded-full bg-secondary/80 flex items-center justify-center hover:bg-destructive/20"
                              title="Supprimer"
                            >
                              <Trash2 size={10} className="text-muted-foreground" />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={(e) => { e.stopPropagation(); togglePin(msg); }}
                                className="w-5 h-5 rounded-full bg-secondary/80 flex items-center justify-center hover:bg-accent/20"
                                title={msg.is_pinned ? "Désépingler" : "Épingler"}
                              >
                                <Pin size={10} className={msg.is_pinned ? "text-accent" : "text-muted-foreground"} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Mobile: context menu on long press */}
                    <AnimatePresence>
                      {activeMenu === msg.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className={`absolute ${isMe ? "right-0" : "left-0"} top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-lg p-1.5 min-w-[140px]`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => { setShowReactions(msg.id); setActiveMenu(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary text-xs text-foreground"
                          >
                            <SmilePlus size={14} /> Réagir
                          </button>
                          <button
                            onClick={() => { setReplyTo(msg); setActiveMenu(null); inputRef.current?.focus(); }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary text-xs text-foreground"
                          >
                            <Reply size={14} /> Répondre
                          </button>
                          {isMe && !msg.audio_url && (
                            <button
                              onClick={() => { setEditingMsg(msg); setEditInput(msg.content); setActiveMenu(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary text-xs text-foreground"
                            >
                              <Pencil size={14} /> Modifier
                            </button>
                          )}
                          {canModify && (
                            <button
                              onClick={() => deleteMessage(msg.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-destructive/10 text-xs text-destructive"
                            >
                              <Trash2 size={14} /> Supprimer
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => togglePin(msg)}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent/10 text-xs text-foreground"
                            >
                              <Pin size={14} /> {msg.is_pinned ? "Désépingler" : "Épingler"}
                            </button>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Reaction picker */}
                    <AnimatePresence>
                      {showReactions === msg.id && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className={`absolute ${isMe ? "right-0" : "left-0"} bottom-full mb-1 z-50 bg-card border border-border rounded-full shadow-lg px-2 py-1 flex gap-1`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {REACTION_EMOJIS.map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => toggleReaction(msg.id, emoji)}
                              className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center text-lg transition-transform hover:scale-125"
                            >
                              {emoji}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
            <AnimatePresence>
              {isBotTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex justify-start"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
                      <Bot size={12} className="text-accent" />
                    </div>
                    <div className="px-4 py-2.5 rounded-2xl bg-accent/10 border border-accent/20">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-accent/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-accent/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-accent/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={bottomRef} />
          </main>

          {/* Reply/Edit banner */}
          {replyTo && (
            <div className="px-4 py-2 bg-muted/50 border-t border-border flex items-center gap-2">
              <Reply size={14} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-primary">{replyTo.user_name}</span>
                <p className="text-xs text-muted-foreground truncate">{replyTo.content}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="shrink-0">
                <X size={14} className="text-muted-foreground" />
              </button>
            </div>
          )}

          {/* Input */}
          <div className="sticky bottom-0 glass px-4 py-3 safe-bottom">
            <div className="max-w-lg mx-auto flex items-center gap-2">
              {isRecording ? (
                <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20">
                  <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
                  <span className="text-sm font-medium text-destructive">{formatTime(recordingTime)}</span>
                  <span className="text-xs text-muted-foreground flex-1">Enregistrement...</span>
                </div>
              ) : (
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder={replyTo ? `Répondre à ${replyTo.user_name}...` : "Écrire un message..."}
                  className="flex-1 px-4 py-3 rounded-xl bg-secondary text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 transition"
                />
              )}

              {/* Mic / Stop button */}
              {isRecording ? (
                <button
                  onClick={stopRecording}
                  className="w-11 h-11 rounded-xl bg-destructive text-destructive-foreground flex items-center justify-center shrink-0"
                >
                  <Square size={16} />
                </button>
              ) : uploadingAudio ? (
                <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                  <Loader2 size={16} className="animate-spin text-muted-foreground" />
                </div>
              ) : input.trim() ? (
                <button
                  onClick={sendMessage}
                  className="w-11 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0"
                >
                  <Send size={18} />
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  className="w-11 h-11 rounded-xl bg-accent text-accent-foreground flex items-center justify-center shrink-0"
                >
                  <Mic size={18} />
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Member profile modal */}
      <AnimatePresence>
        {selectedMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
            onClick={() => setSelectedMember(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-lg bg-card rounded-t-2xl p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-2" />
              <div className="flex items-center gap-4">
                {selectedMember.avatar_url ? (
                  <img src={selectedMember.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
                    {(selectedMember.nickname || selectedMember.full_name || "?")[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-foreground truncate">
                    {selectedMember.nickname || selectedMember.full_name || "Membre"}
                  </h2>
                  {selectedMember.nickname && selectedMember.full_name && (
                    <p className="text-sm text-muted-foreground">{selectedMember.full_name}</p>
                  )}
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                    {selectedMember.member_type === "benevole" ? "Bénévole" : selectedMember.member_type === "both" ? "Bénévole & Bénéficiaire" : "Bénéficiaire"}
                  </span>
                </div>
              </div>

              {selectedMember.bio && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Bio</p>
                  <p className="text-sm text-foreground">{selectedMember.bio}</p>
                </div>
              )}

              {selectedMember.phone && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Téléphone</p>
                  <a href={`tel:${selectedMember.phone}`} className="text-sm text-primary">{selectedMember.phone}</a>
                </div>
              )}

              {selectedMember.id !== user?.id && (
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => { sendFriendRequest(selectedMember.id); setSelectedMember(null); }}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <UserPlus size={14} /> Ajouter
                  </button>
                  <button
                    onClick={() => { navigate(`/messages/${selectedMember.id}`); setSelectedMember(null); }}
                    className="flex-1 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <MessageCircle size={14} /> Message
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Chat;
