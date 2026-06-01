import { useNavigate } from "react-router-dom";
import { User, Bell } from "lucide-react";
import { motion } from "framer-motion";
import logo from "@/assets/logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

const PageHeader = ({ title, subtitle }: PageHeaderProps) => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { unreadCount } = useNotifications();

  return (
    <header className="sticky top-0 z-40 glass safe-top">
      <div className="px-4 py-2.5 flex items-center justify-between max-w-lg mx-auto">
        <div className="flex items-center gap-2.5 min-w-0">
          <img src={logo} alt="Logo" className="w-8 h-8 rounded-xl object-cover shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base font-bold text-foreground leading-tight truncate">{title}</h1>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground leading-tight truncate">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Notifications bell */}
          <button
            onClick={() => navigate("/chat")}
            className="relative w-9 h-9 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform"
          >
            <Bell size={17} className="text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
          {/* Profile avatar */}
          <button
            onClick={() => navigate("/profile")}
            className="w-9 h-9 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center active:scale-95 transition-transform"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <User size={17} className="text-primary" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default PageHeader;
