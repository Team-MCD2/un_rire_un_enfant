import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, Loader2, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface SupportMessage {
  id: string;
  content: string;
  is_admin_reply: boolean;
  created_at: string;
}

const ContactAdmin = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    fetchMessages();

    const channel = supabase
      .channel("support-" + user.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `user_id=eq.${user.id}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as SupportMessage]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMessages = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("support_messages")
      .select("id, content, is_admin_reply, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    setMessages((data as SupportMessage[]) || []);
    setLoading(false);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !user || sending) return;

    setSending(true);
    const { error } = await supabase.from("support_messages").insert({
      user_id: user.id,
      content: text,
      is_admin_reply: false,
    });

    if (error) {
      toast({ title: "Erreur", description: "Message non envoyé.", variant: "destructive" });
    } else {
      setInput("");
    }
    setSending(false);
  };

  if (!user) {
    navigate("/login");
    return null;
  }

  return (
    <div className="safe-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 glass safe-top px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <MessageSquare size={20} className="text-primary" />
        <h1 className="text-lg font-bold">Contacter les responsables</h1>
      </header>

      <div className="flex-1 overflow-auto px-4 py-4 space-y-3">
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="text-center py-12 space-y-2">
            <MessageSquare size={40} className="text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Envoyez un message aux responsables.</p>
            <p className="text-xs text-muted-foreground">Tous les admins verront votre message et pourront vous répondre.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.02 }}
            className={`flex ${msg.is_admin_reply ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.is_admin_reply
                  ? "bg-secondary text-foreground rounded-bl-sm"
                  : "bg-primary text-primary-foreground rounded-br-sm"
              }`}
            >
              {msg.is_admin_reply && (
                <p className="text-[10px] font-semibold text-accent mb-0.5">Responsable</p>
              )}
              {msg.content}
            </div>
          </motion.div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border bg-background/95 backdrop-blur px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Votre message…"
          className="flex-1 px-4 py-3 rounded-xl bg-secondary text-foreground text-sm outline-none focus:ring-2 focus:ring-ring transition"
        />
        <button
          onClick={sendMessage}
          disabled={sending}
          className="w-11 h-11 rounded-xl bg-accent text-accent-foreground flex items-center justify-center shrink-0 disabled:opacity-50 transition hover:bg-accent/90"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
};

export default ContactAdmin;
