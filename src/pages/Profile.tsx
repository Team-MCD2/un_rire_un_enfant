import { ArrowLeft, Camera, Mail, Lock, LogOut, Bell, ShieldCheck, Phone, User, Eye, Save, Pencil, Users, Award, Medal, Star, Crown, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { requestNotificationPermission } from "@/lib/notifications";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

const Profile = () => {
  const navigate = useNavigate();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  // Editable fields
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [memberType, setMemberType] = useState("beneficiaire");
  const [showOnline, setShowOnline] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [stats, setStats] = useState({ activities: 0, distributions: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setNickname(profile.nickname || "");
      setPhone(profile.phone || "");
      setBio(profile.bio || "");
      setMemberType(profile.member_type || "beneficiaire");
      setShowOnline(profile.show_online ?? true);
    }
  }, [profile]);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    };

    const fetchStats = async () => {
      if (!user) return;
      const [{ count: actCount }, { count: distCount }] = await Promise.all([
        supabase.from("activity_proposals").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("distribution_registrations").select("*", { count: "exact", head: true }).eq("user_id", user.id)
      ]);
      setStats({ activities: actCount || 0, distributions: distCount || 0 });
    };

    checkAdmin();
    fetchStats();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        nickname,
        phone,
        bio,
        member_type: memberType,
        show_online: showOnline,
      })
      .eq("id", user.id);

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      await refreshProfile();
      toast({ title: "Profil mis à jour ✅" });
      setEditing(false);
    }
    setSaving(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Erreur upload", description: uploadError.message, variant: "destructive" });
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: urlData.publicUrl })
      .eq("id", user.id);

    if (updateError) {
      toast({ title: "Erreur", description: updateError.message, variant: "destructive" });
    } else {
      await refreshProfile();
      toast({ title: "Photo de profil mise à jour ✅" });
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      toast({ title: "Notifications activées", description: "Vous recevrez des notifications de l'association." });
    } else {
      toast({ title: "Notifications refusées", description: "Vous pouvez les activer dans les paramètres de votre navigateur.", variant: "destructive" });
    }
  };

  const displayName = profile?.nickname || profile?.full_name || user?.email?.split("@")[0] || "Utilisateur";
  const displayEmail = user?.email || "";
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="safe-screen bg-background pb-24">
      <header className="sticky top-0 z-40 glass safe-top px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <h1 className="text-lg font-bold">Paramètres</h1>
      </header>

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Avatar */}
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-3">
          <div className="relative">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-2 border-primary/20" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary">
                {initials}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg"
            >
              <Camera size={14} />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-foreground">{displayName}</h2>
            <p className="text-sm text-muted-foreground">{displayEmail}</p>
            {showOnline && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <span className="w-2 h-2 rounded-full bg-green-500" /> En ligne
              </span>
            )}
          </div>
        </motion.div>

        {/* Badges / Gamification */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Award size={18} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Mes Badges</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col items-center justify-center p-3 bg-secondary/50 rounded-xl border border-border min-w-[80px]">
              <Star size={24} className="text-yellow-500 mb-1" />
              <span className="text-[10px] font-medium text-center">Membre<br/>Actif</span>
            </div>
            
            {stats.activities > 0 ? (
              <div className="flex flex-col items-center justify-center p-3 bg-accent/10 rounded-xl border border-accent/20 min-w-[80px]">
                <Medal size={24} className="text-accent mb-1" />
                <span className="text-[10px] font-medium text-center text-accent">Initiateur<br/>({stats.activities})</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-3 bg-secondary/20 rounded-xl border border-border/50 min-w-[80px] opacity-40 grayscale">
                <Medal size={24} className="text-muted-foreground mb-1" />
                <span className="text-[10px] font-medium text-center text-muted-foreground">Initiateur</span>
              </div>
            )}

            {stats.distributions > 0 ? (
              <div className="flex flex-col items-center justify-center p-3 bg-green-500/10 rounded-xl border border-green-500/20 min-w-[80px]">
                <Award size={24} className="text-green-500 mb-1" />
                <span className="text-[10px] font-medium text-center text-green-600">Solidaire<br/>({stats.distributions})</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-3 bg-secondary/20 rounded-xl border border-border/50 min-w-[80px] opacity-40 grayscale">
                <Award size={24} className="text-muted-foreground mb-1" />
                <span className="text-[10px] font-medium text-center text-muted-foreground">Solidaire</span>
              </div>
            )}

            {stats.activities + stats.distributions >= 10 ? (
              <div className="flex flex-col items-center justify-center p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 min-w-[80px] relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 to-transparent" />
                <Crown size={24} className="text-purple-500 mb-1 relative z-10" />
                <span className="text-[10px] font-medium text-center text-purple-600 relative z-10">Pilier de<br/>l'asso</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-3 bg-secondary/20 rounded-xl border border-border/50 min-w-[80px] opacity-40 grayscale">
                <Crown size={24} className="text-muted-foreground mb-1" />
                <span className="text-[10px] font-medium text-center text-muted-foreground">Pilier (10)</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Settings fields */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card border border-border rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Informations</h3>
            {!editing ? (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="gap-1 text-xs">
                <Pencil size={14} /> Modifier
              </Button>
            ) : (
              <Button variant="default" size="sm" onClick={handleSave} disabled={saving} className="gap-1 text-xs">
                <Save size={14} /> {saving ? "..." : "Enregistrer"}
              </Button>
            )}
          </div>

          {/* Nickname */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-muted-foreground">
              <User size={14} /> Surnom
            </Label>
            {editing ? (
              <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Mon surnom" />
            ) : (
              <p className="text-sm font-medium text-foreground pl-1">{nickname || "Non défini"}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-muted-foreground">
              <Phone size={14} /> Numéro de téléphone
            </Label>
            {editing ? (
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" />
            ) : (
              <p className="text-sm font-medium text-foreground pl-1">{phone || "Non défini"}</p>
            )}
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-muted-foreground">
              <User size={14} /> Bio
            </Label>
            {editing ? (
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Parlez de vous en quelques mots…"
                rows={3}
                maxLength={200}
                className="w-full px-3 py-2 rounded-xl bg-secondary text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 transition placeholder:text-muted-foreground/50 resize-none"
              />
            ) : (
              <p className="text-sm font-medium text-foreground pl-1">{bio || "Non définie"}</p>
            )}
          </div>

          {/* Member type */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-muted-foreground">
              <Users size={14} /> Type de membre
            </Label>
            {editing ? (
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "beneficiaire", label: "Bénéficiaire" },
                  { value: "benevole", label: "Bénévole" },
                  { value: "both", label: "Les deux" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMemberType(opt.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      memberType === opt.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary text-foreground border-border hover:border-primary/40"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm font-medium text-foreground pl-1">
                {memberType === "both" ? "Bénévole & Bénéficiaire" : memberType === "benevole" ? "Bénévole" : "Bénéficiaire"}
              </p>
            )}
          </div>

          {/* Email (read-only) */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-muted-foreground">
              <Mail size={14} /> Email
            </Label>
            <p className="text-sm font-medium text-foreground pl-1">{displayEmail}</p>
          </div>

          {/* Password (read-only display) */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-muted-foreground">
              <Lock size={14} /> Mot de passe
            </Label>
            <p className="text-sm font-medium text-foreground pl-1">••••••••</p>
          </div>
        </motion.div>

        {/* Online status toggle */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Eye size={18} className="text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Statut en ligne visible</p>
              <p className="text-xs text-muted-foreground">Les autres verront quand vous êtes connecté</p>
            </div>
          </div>
          <Switch checked={showOnline} onCheckedChange={async (val) => {
            setShowOnline(val);
            if (user) {
              await supabase.from("profiles").update({ show_online: val }).eq("id", user.id);
              await refreshProfile();
            }
          }} />
        </motion.div>

        {/* Notifications */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onClick={handleEnableNotifications}
          className="w-full py-3 rounded-2xl bg-primary/10 text-primary font-medium text-sm flex items-center justify-center gap-2"
        >
          <Bell size={16} /> Activer les notifications
        </motion.button>

        {isAdmin && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            onClick={() => navigate("/admin")}
            className="w-full py-3 rounded-2xl bg-accent text-accent-foreground font-medium text-sm flex items-center justify-center gap-2"
          >
            <ShieldCheck size={16} /> Panneau d'administration
          </motion.button>
        )}

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          onClick={() => navigate("/legal")}
          className="w-full py-3 rounded-2xl bg-secondary/50 text-foreground font-medium text-sm flex items-center justify-center gap-2"
        >
          <FileText size={16} className="text-muted-foreground" /> Légal & Confidentialité
        </motion.button>

        <button
          onClick={handleLogout}
          className="w-full py-3 rounded-2xl bg-destructive/10 text-destructive font-medium text-sm flex items-center justify-center gap-2"
        >
          <LogOut size={16} /> Se déconnecter
        </button>
      </main>
    </div>
  );
};

export default Profile;
