import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Users, KeyRound, Loader2, Search, ShieldCheck, Bot, UserCheck, UserX, Crown, Trash2, Plus, MessageSquare, Send, CalendarCheck, Ban, Pencil, X, Save, ShieldOff, Settings, Link } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface UserInfo {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  banned?: boolean;
}

interface PendingRequest {
  id: string;
  user_id: string;
  room_id: string;
  status: string;
  created_at: string;
  room_name?: string;
  user_email?: string;
  user_name?: string;
}

interface BotInstruction {
  id: string;
  instruction: string;
  created_at: string;
}

interface SupportThread {
  user_id: string;
  user_name: string;
  last_message: string;
  last_date: string;
  unread: number;
}

interface SupportMsg {
  id: string;
  content: string;
  is_admin_reply: boolean;
  created_at: string;
}

interface ActivityProposal {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  proposed_date: string | null;
  location: string | null;
  city: string | null;
  status: string;
  created_at: string;
  user_id: string;
  user_name?: string;
}

type AdminTab = "users" | "access" | "bot" | "roles" | "inbox" | "activities" | "settings";

const Admin = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<AdminTab>("users");

  // Access requests
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Bot instructions
  const [instructions, setInstructions] = useState<BotInstruction[]>([]);
  const [newInstruction, setNewInstruction] = useState("");
  const [loadingInstructions, setLoadingInstructions] = useState(false);

  // Admin nomination
  const [adminUsers, setAdminUsers] = useState<string[]>([]);
  const [nominatingId, setNominatingId] = useState<string | null>(null);

  // Inbox
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<SupportMsg[]>([]);
  const [replyInput, setReplyInput] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  // Activity proposals
  const [proposals, setProposals] = useState<ActivityProposal[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(false);

  // User management
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ full_name: "", nickname: "", phone: "" });
  const [userProfiles, setUserProfiles] = useState<Record<string, { full_name: string | null; nickname: string | null; phone: string | null }>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Settings
  const [paypalLink, setPaypalLink] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => { checkAdmin(); }, [user]);

  const checkAdmin = async () => {
    if (!user) { setIsAdmin(false); setLoading(false); return; }
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (data) {
      setIsAdmin(true);
      fetchUsers();
      fetchPendingRequests();
      fetchInstructions();
      fetchAdminUsers();
      fetchThreads();
      fetchProposals();
      fetchSettings();
    } else {
      setIsAdmin(false);
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-users", { body: { action: "list_users" } });
    if (error) {
      toast({ title: "Erreur", description: "Impossible de charger les utilisateurs", variant: "destructive" });
    } else {
      setUsers(data.users || []);
    }
    // Fetch all profiles for editing
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, nickname, phone");
    if (profiles) {
      const map: Record<string, { id: string; full_name: string | null; nickname: string | null; phone: string | null }> = {};
      profiles.forEach((p) => { map[p.id] = p; });
      setUserProfiles(map);
    }
    setLoading(false);
  };

  const handleBanUser = async (targetUserId: string, ban: boolean) => {
    setActionLoading(targetUserId);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: ban ? "ban_user" : "unban_user", targetUserId },
    });
    if (error || data?.error) {
      toast({ title: "Erreur", description: data?.error || "Échec", variant: "destructive" });
    } else {
      toast({ title: ban ? "Utilisateur banni 🚫" : "Utilisateur débanni ✅" });
      fetchUsers();
    }
    setActionLoading(null);
  };

  const startEditUser = (u: UserInfo) => {
    const profile = userProfiles[u.id];
    setEditingUser(u.id);
    setEditForm({
      full_name: profile?.full_name || u.full_name || "",
      nickname: profile?.nickname || "",
      phone: profile?.phone || "",
    });
  };

  const saveEditUser = async (targetUserId: string) => {
    setActionLoading(targetUserId);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: {
        action: "update_profile",
        targetUserId,
        updates: {
          full_name: editForm.full_name || null,
          nickname: editForm.nickname || null,
          phone: editForm.phone || null,
        },
      },
    });
    if (error || data?.error) {
      toast({ title: "Erreur", description: data?.error || "Échec", variant: "destructive" });
    } else {
      toast({ title: "Profil mis à jour ✅" });
      setEditingUser(null);
      fetchUsers();
    }
    setActionLoading(null);
  };

  const fetchPendingRequests = async () => {
    setLoadingRequests(true);
    const { data: memberships } = await supabase
      .from("room_memberships")
      .select("*")
      .order("created_at", { ascending: false });

    if (memberships) {
      // Fetch room names and user profiles
      const { data: rooms } = await supabase.from("chat_rooms").select("id, name");
      const { data: profiles } = await supabase.from("profiles").select("id, full_name");

      const enriched = memberships.map((m) => ({
        ...m,
        room_name: rooms?.find((r) => r.id === m.room_id)?.name || "Inconnu",
        user_name: profiles?.find((p) => p.id === m.user_id)?.full_name || "Sans nom",
      }));
      setPendingRequests(enriched);
    }
    setLoadingRequests(false);
  };

  const fetchInstructions = async () => {
    setLoadingInstructions(true);
    const { data } = await supabase.from("bot_instructions").select("*").order("created_at", { ascending: false });
    if (data) setInstructions(data as BotInstruction[]);
    setLoadingInstructions(false);
  };

  const fetchAdminUsers = async () => {
    const { data } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    if (data) setAdminUsers(data.map((d) => d.user_id));
  };

  const fetchThreads = async () => {
    const { data } = await supabase
      .from("support_messages")
      .select("user_id, content, is_admin_reply, created_at")
      .order("created_at", { ascending: false });
    if (!data) return;

    const { data: profiles } = await supabase.from("profiles").select("id, full_name");

    const grouped: Record<string, SupportThread> = {};
    for (const msg of data) {
      if (!grouped[msg.user_id]) {
        const profile = profiles?.find((p) => p.id === msg.user_id);
        grouped[msg.user_id] = {
          user_id: msg.user_id,
          user_name: profile?.full_name || "Utilisateur",
          last_message: msg.content,
          last_date: msg.created_at,
          unread: 0,
        };
      }
      if (!msg.is_admin_reply) grouped[msg.user_id].unread++;
    }
    setThreads(Object.values(grouped));
  };

  const fetchThreadMessages = async (userId: string) => {
    setSelectedThread(userId);
    const { data } = await supabase
      .from("support_messages")
      .select("id, content, is_admin_reply, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    setThreadMessages((data as SupportMsg[]) || []);
  };

  const sendReply = async () => {
    if (!replyInput.trim() || !selectedThread || !user) return;
    setSendingReply(true);
    const { error } = await supabase.from("support_messages").insert({
      user_id: selectedThread,
      content: replyInput.trim(),
      is_admin_reply: true,
      admin_id: user.id,
    });
    if (error) {
      toast({ title: "Erreur", description: "Réponse non envoyée.", variant: "destructive" });
    } else {
      setReplyInput("");
      fetchThreadMessages(selectedThread);
    }
    setSendingReply(false);
  };

  const handleResetPassword = async (targetUser: UserInfo) => {
    setResettingId(targetUser.id);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "reset_password", targetEmail: targetUser.email },
    });
    if (error || data?.error) {
      toast({ title: "Erreur", description: data?.error || "Échec", variant: "destructive" });
    } else {
      toast({ title: "Succès", description: `Email envoyé à ${targetUser.email}` });
    }
    setResettingId(null);
  };

  const handleMembership = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("room_memberships").update({ status }).eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: "Impossible de mettre à jour", variant: "destructive" });
    } else {
      toast({ title: "Succès", description: status === "approved" ? "Membre approuvé" : "Demande refusée" });
      fetchPendingRequests();
    }
  };

  const addInstruction = async () => {
    if (!newInstruction.trim() || !user) return;
    const { error } = await supabase.from("bot_instructions").insert({
      instruction: newInstruction.trim(),
      created_by: user.id,
    });
    if (error) {
      toast({ title: "Erreur", description: "Impossible d'ajouter l'instruction", variant: "destructive" });
    } else {
      setNewInstruction("");
      fetchInstructions();
      toast({ title: "Ajouté", description: "Le bot a appris cette information" });
    }
  };

  const deleteInstruction = async (id: string) => {
    await supabase.from("bot_instructions").delete().eq("id", id);
    fetchInstructions();
  };

  const toggleAdmin = async (targetUserId: string) => {
    setNominatingId(targetUserId);
    const isCurrentlyAdmin = adminUsers.includes(targetUserId);
    if (isCurrentlyAdmin) {
      // Remove admin role via edge function
      const { error } = await supabase.functions.invoke("admin-users", {
        body: { action: "remove_role", targetUserId, role: "admin" },
      });
      if (error) {
        toast({ title: "Erreur", variant: "destructive" });
      } else {
        toast({ title: "Rôle retiré" });
        fetchAdminUsers();
      }
    } else {
      const { error } = await supabase.functions.invoke("admin-users", {
        body: { action: "add_role", targetUserId, role: "admin" },
      });
      if (error) {
        toast({ title: "Erreur", variant: "destructive" });
      } else {
        toast({ title: "Admin nommé !" });
        fetchAdminUsers();
      }
    }
    setNominatingId(null);
  };

  const fetchProposals = async () => {
    setLoadingProposals(true);
    const { data } = await supabase
      .from("activity_proposals")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name");
      const enriched = data.map((p) => ({
        ...p,
        user_name: profiles?.find((pr) => pr.id === p.user_id)?.full_name || "Sans nom",
      }));
      setProposals(enriched);
    }
    setLoadingProposals(false);
  };

  const handleProposal = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase
      .from("activity_proposals")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast({ title: "Erreur", description: "Impossible de mettre à jour.", variant: "destructive" });
      return;
    }

    const proposal = proposals.find(p => p.id === id);
    const statusLabel = status === "approved" ? "✅ validée" : "❌ refusée";
    toast({ title: "Proposition mise à jour", description: `"${proposal?.title}" ${statusLabel}` });

    // Send notification to the member via support_messages
    if (proposal && user) {
      const message = status === "approved"
        ? `Bonne nouvelle ! Votre proposition d'activité "${proposal.title}" a été validée par un administrateur. 🎉`
        : `Votre proposition d'activité "${proposal.title}" n'a pas été retenue. N'hésitez pas à en proposer une autre !`;

      await supabase.from("support_messages").insert({
        user_id: proposal.user_id,
        content: message,
        is_admin_reply: true,
        admin_id: user.id,
      });
    }

    // Send email to volunteers when activity is approved
    if (status === "approved" && proposal) {
      try {
        await supabase.functions.invoke("send-email", {
          body: {
            type: "activity",
            title: proposal.title,
            description: proposal.description || null,
            event_date: proposal.proposed_date || null,
            location: proposal.location || null,
          },
        });
      } catch (e) {
        console.error("Email notification error:", e);
      }
    }

    fetchProposals();
  };

  const handleDeleteActivity = async (id: string) => {
    const proposal = proposals.find(p => p.id === id);
    if (!proposal || !user) return;

    // Fetch registered users before deleting (cascade will remove registrations)
    const { data: registrations } = await supabase
      .from("activity_registrations")
      .select("user_id")
      .eq("activity_id", id);

    // Delete the activity (registrations cascade)
    const { error } = await supabase
      .from("activity_proposals")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Erreur", description: "Impossible de supprimer.", variant: "destructive" });
      return;
    }

    // Notify all registered users via support_messages
    if (registrations && registrations.length > 0) {
      const notifications = registrations.map((reg) => ({
        user_id: reg.user_id,
        content: `⚠️ L'activité "${proposal.title}" a été annulée par un administrateur. Nous sommes désolés pour la gêne occasionnée.`,
        is_admin_reply: true,
        admin_id: user.id,
      }));

      await supabase.from("support_messages").insert(notifications);
    }

    // Also notify the proposal creator
    await supabase.from("support_messages").insert({
      user_id: proposal.user_id,
      content: `⚠️ Votre activité "${proposal.title}" a été supprimée par un administrateur.`,
      is_admin_reply: true,
      admin_id: user.id,
    });

    toast({ title: "Activité supprimée", description: `"${proposal.title}" — ${registrations?.length || 0} inscrit(s) notifié(s)` });
    fetchProposals();
  };

  if (!user) { navigate("/login"); return null; }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <ShieldCheck size={48} className="text-muted-foreground" />
        <p className="text-muted-foreground text-center">Accès réservé aux administrateurs.</p>
        <button onClick={() => navigate(-1)} className="text-primary text-sm font-medium">Retour</button>
      </div>
    );
  }

  const filteredUsers = users.filter(
    (u) => u.email.toLowerCase().includes(search.toLowerCase()) || (u.full_name && u.full_name.toLowerCase().includes(search.toLowerCase()))
  );

  const pendingOnly = pendingRequests.filter((r) => r.status === "pending");
  const allRequests = pendingRequests;

  const inboxUnread = threads.reduce((s, t) => s + t.unread, 0);

  const pendingProposals = proposals.filter(p => p.status === "pending");

  const fetchSettings = async () => {
    const { data } = await supabase.from("app_settings").select("*").eq("key", "paypal_link").maybeSingle();
    if (data) setPaypalLink(data.value);
  };

  const savePaypalLink = async () => {
    setSavingSettings(true);
    const { error } = await supabase.from("app_settings").update({ value: paypalLink, updated_at: new Date().toISOString() }).eq("key", "paypal_link");
    if (error) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder.", variant: "destructive" });
    } else {
      toast({ title: "Lien PayPal mis à jour ✅" });
    }
    setSavingSettings(false);
  };

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "inbox", label: "Boîte", icon: <MessageSquare size={16} />, badge: inboxUnread },
    { id: "activities", label: "Activités", icon: <CalendarCheck size={16} />, badge: pendingProposals.length },
    { id: "users", label: "Membres", icon: <Users size={16} /> },
    { id: "access", label: "Accès", icon: <UserCheck size={16} />, badge: pendingOnly.length },
    { id: "bot", label: "Bot", icon: <Bot size={16} /> },
    { id: "roles", label: "Rôles", icon: <Crown size={16} /> },
    { id: "settings", label: "Config", icon: <Settings size={16} /> },
  ];

  return (
    <div className="safe-screen bg-background pb-24">
      <header className="sticky top-0 z-40 glass safe-top px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <ShieldCheck size={20} className="text-primary" />
        <h1 className="text-lg font-bold">Administration</h1>
      </header>

      {/* Tabs */}
      <div className="sticky top-[60px] z-30 glass px-4 py-2">
        <div className="max-w-lg mx-auto flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge ? (
                <span className="ml-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <main className="px-4 py-4 max-w-lg mx-auto space-y-4">
        {/* Users tab */}
        {activeTab === "users" && (
          <>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Rechercher un utilisateur..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-3 rounded-xl bg-secondary text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 transition"
              />
            </div>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map((u, i) => {
                  const isExpanded = expandedUser === u.id;
                  const isEditing = editingUser === u.id;
                  const profile = userProfiles[u.id];
                  return (
                    <motion.div key={u.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      className={`bg-card border rounded-2xl overflow-hidden transition-all ${u.banned ? "border-destructive/30 bg-destructive/5" : "border-border"}`}>
                      <button
                        onClick={() => { setExpandedUser(isExpanded ? null : u.id); setEditingUser(null); }}
                        className="w-full p-4 flex items-center justify-between gap-3 text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground truncate">{u.full_name || "Sans nom"}</p>
                            {u.banned && <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">BANNI</span>}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <span className="text-muted-foreground text-xs">{isExpanded ? "▲" : "▼"}</span>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                          {/* Profile info */}
                          {!isEditing ? (
                            <div className="space-y-1 text-xs text-muted-foreground">
                              <p>Nom : <span className="text-foreground">{profile?.full_name || "—"}</span></p>
                              <p>Surnom : <span className="text-foreground">{profile?.nickname || "—"}</span></p>
                              <p>Téléphone : <span className="text-foreground">{profile?.phone || "—"}</span></p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {[
                                { label: "Nom complet", key: "full_name" },
                                { label: "Surnom", key: "nickname" },
                                { label: "Téléphone", key: "phone" },
                              ].map((field) => (
                                <div key={field.key}>
                                  <label className="text-[11px] font-medium text-muted-foreground">{field.label}</label>
                                  <input
                                    value={editForm[field.key as keyof typeof editForm]}
                                    onChange={(e) => setEditForm({ ...editForm, [field.key]: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 transition"
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex flex-wrap gap-2">
                            {!isEditing ? (
                              <button onClick={() => startEditUser(u)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition">
                                <Pencil size={13} /> Modifier
                              </button>
                            ) : (
                              <>
                                <button onClick={() => saveEditUser(u.id)} disabled={actionLoading === u.id}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition disabled:opacity-50">
                                  {actionLoading === u.id ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Enregistrer
                                </button>
                                <button onClick={() => setEditingUser(null)}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary text-muted-foreground text-xs font-medium hover:bg-secondary/80 transition">
                                  <X size={13} /> Annuler
                                </button>
                              </>
                            )}

                            <button onClick={() => handleResetPassword(u)} disabled={resettingId === u.id}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition disabled:opacity-50">
                              {resettingId === u.id ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />} Réinit. mdp
                            </button>

                            {u.banned ? (
                              <button onClick={() => handleBanUser(u.id, false)} disabled={actionLoading === u.id}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition disabled:opacity-50">
                                {actionLoading === u.id ? <Loader2 size={13} className="animate-spin" /> : <ShieldOff size={13} />} Débannir
                              </button>
                            ) : (
                              <button onClick={() => handleBanUser(u.id, true)} disabled={actionLoading === u.id}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition disabled:opacity-50">
                                {actionLoading === u.id ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />} Bannir
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
                {filteredUsers.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Aucun utilisateur trouvé.</p>}
              </div>
            )}
          </>
        )}

        {/* Access requests tab */}
        {activeTab === "access" && (
          <>
            <h2 className="text-sm font-semibold text-foreground">Demandes d'accès aux salons</h2>
            {loadingRequests ? (
              <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>
            ) : allRequests.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Aucune demande.</p>
            ) : (
              <div className="space-y-2">
                {allRequests.map((req, i) => (
                  <motion.div key={req.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    className="bg-card border border-border rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{req.user_name}</p>
                        <p className="text-xs text-muted-foreground">Salon : {req.room_name}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
                        req.status === "pending" ? "bg-accent/10 text-accent" :
                        req.status === "approved" ? "bg-primary/10 text-primary" :
                        "bg-destructive/10 text-destructive"
                      }`}>
                        {req.status === "pending" ? "⏳ En attente" : req.status === "approved" ? "✅ Approuvé" : "❌ Refusé"}
                      </span>
                    </div>
                    {req.status === "pending" && (
                      <div className="flex gap-2">
                        <button onClick={() => handleMembership(req.id, "approved")}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium">
                          <UserCheck size={14} /> Approuver
                        </button>
                        <button onClick={() => handleMembership(req.id, "rejected")}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-medium">
                          <UserX size={14} /> Refuser
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Bot instructions tab */}
        {activeTab === "bot" && (
          <>
            <h2 className="text-sm font-semibold text-foreground">Instructions du Bot (Nino 🤖)</h2>
            <p className="text-xs text-muted-foreground">
              Ajoutez des informations que le bot utilisera pour répondre aux questions dans le salon Bénévoles.
            </p>
            <div className="flex gap-2">
              <input
                value={newInstruction}
                onChange={(e) => setNewInstruction(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addInstruction()}
                placeholder="Ex: Le local ferme à 18h..."
                className="flex-1 px-4 py-3 rounded-xl bg-secondary text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 transition"
              />
              <button onClick={addInstruction}
                className="w-11 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                <Plus size={18} />
              </button>
            </div>
            {loadingInstructions ? (
              <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-primary" /></div>
            ) : instructions.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Aucune instruction ajoutée.</p>
            ) : (
              <div className="space-y-2">
                {instructions.map((inst, i) => (
                  <motion.div key={inst.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3">
                    <p className="text-sm text-foreground flex-1">{inst.instruction}</p>
                    <button onClick={() => deleteInstruction(inst.id)}
                      className="shrink-0 w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition">
                      <Trash2 size={14} />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Roles tab */}
        {activeTab === "roles" && (
          <>
            <h2 className="text-sm font-semibold text-foreground">Nomination d'administrateurs</h2>
            <p className="text-xs text-muted-foreground">Cochez pour nommer un utilisateur administrateur.</p>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-2">
                {users.map((u, i) => {
                  const isUserAdmin = adminUsers.includes(u.id);
                  return (
                    <motion.div key={u.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{u.full_name || "Sans nom"}</p>
                          {isUserAdmin && <Crown size={14} className="text-accent shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <button
                        onClick={() => toggleAdmin(u.id)}
                        disabled={nominatingId === u.id}
                        className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition ${
                          isUserAdmin
                            ? "bg-accent/10 text-accent hover:bg-accent/20"
                            : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                        } disabled:opacity-50`}
                      >
                        {nominatingId === u.id ? <Loader2 size={14} className="animate-spin" /> : <Crown size={14} />}
                        {isUserAdmin ? "Admin ✓" : "Nommer"}
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Inbox tab */}
        {activeTab === "inbox" && (
          <>
            {!selectedThread ? (
              <>
                <h2 className="text-sm font-semibold text-foreground">Messages des membres</h2>
                {threads.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">Aucun message reçu.</p>
                ) : (
                  <div className="space-y-2">
                    {threads.map((t, i) => (
                      <motion.button
                        key={t.user_id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        onClick={() => fetchThreadMessages(t.user_id)}
                        className="w-full bg-card border border-border rounded-2xl p-4 text-left space-y-1 hover:border-primary/30 transition"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground">{t.user_name}</p>
                          {t.unread > 0 && (
                            <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">{t.unread}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{t.last_message}</p>
                      </motion.button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <button onClick={() => setSelectedThread(null)} className="text-xs text-primary font-medium flex items-center gap-1">
                  ← Retour aux conversations
                </button>
                <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col" style={{ maxHeight: "55vh" }}>
                  <div className="flex-1 overflow-auto p-4 space-y-2">
                    {threadMessages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.is_admin_reply ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                          msg.is_admin_reply
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-secondary text-foreground rounded-bl-sm"
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border p-3 flex items-center gap-2">
                    <input
                      value={replyInput}
                      onChange={(e) => setReplyInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendReply()}
                      placeholder="Répondre…"
                      className="flex-1 px-3 py-2 rounded-xl bg-secondary text-foreground text-sm outline-none focus:ring-2 focus:ring-ring transition"
                    />
                    <button onClick={sendReply} disabled={sendingReply || !replyInput.trim()}
                      className="w-9 h-9 rounded-xl bg-accent text-accent-foreground flex items-center justify-center shrink-0 disabled:opacity-50">
                      {sendingReply ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* Activities proposals tab */}
        {activeTab === "activities" && (
          <>
            <h2 className="text-sm font-semibold text-foreground">Propositions d'activités</h2>
            {loadingProposals ? (
              <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>
            ) : proposals.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Aucune proposition.</p>
            ) : (
              <div className="space-y-2">
                {proposals.map((p, i) => (
                  <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    className="bg-card border border-border rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">{p.title}</p>
                        <p className="text-xs text-muted-foreground">Par {p.user_name}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-lg shrink-0 ${
                        p.status === "pending" ? "bg-accent/10 text-accent" :
                        p.status === "approved" ? "bg-primary/10 text-primary" :
                        "bg-destructive/10 text-destructive"
                      }`}>
                        {p.status === "pending" ? "⏳ En attente" : p.status === "approved" ? "✅ Validée" : "❌ Refusée"}
                      </span>
                    </div>
                    {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      {p.category && <span className="bg-secondary px-2 py-0.5 rounded-lg">{p.category}</span>}
                      {p.city && <span className="bg-secondary px-2 py-0.5 rounded-lg">📍 {p.city}</span>}
                      {p.location && <span className="bg-secondary px-2 py-0.5 rounded-lg">{p.location}</span>}
                      {p.proposed_date && <span className="bg-secondary px-2 py-0.5 rounded-lg">📅 {new Date(p.proposed_date).toLocaleDateString("fr-FR")}</span>}
                    </div>
                    <div className="flex gap-2 pt-1">
                      {p.status === "pending" && (
                        <>
                          <button onClick={() => handleProposal(p.id, "approved")}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium">
                            <UserCheck size={14} /> Valider
                          </button>
                          <button onClick={() => handleProposal(p.id, "rejected")}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-medium">
                            <UserX size={14} /> Refuser
                          </button>
                        </>
                      )}
                      <button onClick={() => handleDeleteActivity(p.id)}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors">
                        <Trash2 size={14} /> Supprimer
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Settings tab */}
        {activeTab === "settings" && (
          <>
            <h2 className="text-sm font-semibold text-foreground">Configuration</h2>

            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Link size={16} className="text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Lien PayPal</h3>
              </div>
              <p className="text-xs text-muted-foreground">Ce lien sera utilisé pour les dons sur la page Soutenir.</p>
              <input
                value={paypalLink}
                onChange={(e) => setPaypalLink(e.target.value)}
                placeholder="https://paypal.me/votrelien"
                className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 transition"
              />
              <button
                onClick={savePaypalLink}
                disabled={savingSettings}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {savingSettings ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Enregistrer
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Admin;
