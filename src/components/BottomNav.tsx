import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Calendar, Image, MessageCircle, UtensilsCrossed, Heart, FileText, Lightbulb } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const tabs = [
  { path: "/blog", label: "Aventure", icon: Image, benevoleOnly: true },
  { path: "/chat", label: "Chat", icon: MessageCircle },
  { path: "/", label: "Activités", icon: Calendar },
  { path: "/ideas", label: "Idées", icon: Lightbulb },
  { path: "/distribution", label: "Repas", icon: UtensilsCrossed },
  { path: "/soutenir", label: "Soutenir", icon: Heart },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();
  const [unreadChat, setUnreadChat] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  const isBenevole = profile?.member_type === "benevole" || profile?.member_type === "both";

  // Fetch total unread for chat (private messages)
  useEffect(() => {
    if (!user) return;

    const fetchUnread = async () => {
      const { count } = await supabase
        .from("private_messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("read", false);
      setUnreadChat(count || 0);
    };

    fetchUnread();

    const channel = supabase
      .channel("bottomnav-unread")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "private_messages",
        filter: `receiver_id=eq.${user.id}`,
      }, () => fetchUnread())
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "private_messages",
        filter: `receiver_id=eq.${user.id}`,
      }, () => fetchUnread())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Fetch unread notifications count
  useEffect(() => {
    if (!user) return;

    const fetchNotifs = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      setUnreadNotifs(count || 0);
    };

    fetchNotifs();

    const channel = supabase
      .channel("bottomnav-notifs")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, () => fetchNotifs())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Contact requests
  const [pendingRequests, setPendingRequests] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchRequests = async () => {
      const { count } = await supabase
        .from("contact_requests")
        .select("*", { count: "exact", head: true })
        .eq("target_id", user.id)
        .eq("status", "pending");
      setPendingRequests(count || 0);
    };
    fetchRequests();

    const ch = supabase
      .channel("bottomnav-requests")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "contact_requests",
      }, () => fetchRequests())
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const totalBadge = unreadChat + pendingRequests;

  if (["/login", "/register", "/profile", "/contact"].includes(location.pathname)) return null;

  const filteredTabs = tabs.filter(tab => {
    if (tab.adminOnly && !isAdmin) return false;
    if (tab.benevoleOnly && !isBenevole && !isAdmin) return false;
    return true;
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-[env(safe-area-inset-bottom,8px)]">
      <div className="glass rounded-2xl mx-auto max-w-lg flex items-center justify-around py-2 mb-2">
        {filteredTabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const badge = tab.path === "/chat" ? totalBadge : 0;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-primary/10 rounded-xl"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <div className="relative">
                <tab.icon
                  size={20}
                  className={isActive ? "text-primary" : "text-muted-foreground"}
                />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-medium ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
