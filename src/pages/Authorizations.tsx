import { useEffect, useState, useRef, useCallback } from "react";
import { FileCheck, Plus, X, Trash2, Loader2, Pen, Download, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import PageHeader from "@/components/PageHeader";

interface AuthForm {
  id: string;
  title: string;
  form_type: string;
  description: string | null;
  created_at: string;
  signature_count?: number;
  signed_by_me?: boolean;
}

interface Signature {
  id: string;
  parent_name: string;
  child_name: string;
  signature_data: string;
  signed_at: string;
  user_id: string;
}

const FORM_TYPES = [
  { value: "sortie", label: "Autorisation de sortie" },
  { value: "droit_image", label: "Droit à l'image" },
  { value: "autre", label: "Autre" },
];

const Authorizations = () => {
  const { user } = useAuth();
  const [forms, setForms] = useState<AuthForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ title: "", form_type: "sortie", description: "" });

  // Signing state
  const [signingForm, setSigningForm] = useState<AuthForm | null>(null);
  const [parentName, setParentName] = useState("");
  const [childName, setChildName] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // View signatures
  const [viewingSignatures, setViewingSignatures] = useState<string | null>(null);
  const [signatures, setSignatures] = useState<Signature[]>([]);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => setIsAdmin(Boolean(data)));
  }, [user]);

  const fetchForms = async () => {
    setLoading(true);
    const { data: formsData } = await supabase
      .from("authorization_forms")
      .select("*")
      .order("created_at", { ascending: false });

    if (!formsData || formsData.length === 0) { setForms([]); setLoading(false); return; }

    const formIds = formsData.map((f) => f.id);
    const { data: sigs } = await supabase
      .from("authorization_signatures")
      .select("form_id, user_id")
      .in("form_id", formIds);

    const sigCounts: Record<string, number> = {};
    const mySigs = new Set<string>();
    (sigs ?? []).forEach((s) => {
      sigCounts[s.form_id] = (sigCounts[s.form_id] || 0) + 1;
      if (user && s.user_id === user.id) mySigs.add(s.form_id);
    });

    setForms(formsData.map((f) => ({
      ...f,
      signature_count: sigCounts[f.id] || 0,
      signed_by_me: mySigs.has(f.id),
    })));
    setLoading(false);
  };

  useEffect(() => { fetchForms(); }, [user]);

  const handleCreateForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("authorization_forms").insert({
        created_by: user.id,
        title: formData.title.trim(),
        form_type: formData.form_type,
        description: formData.description.trim() || null,
      });
      if (error) throw error;
      toast({ title: "Formulaire créé ✅" });
      setFormData({ title: "", form_type: "sortie", description: "" });
      setShowCreate(false);
      fetchForms();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteForm = async (id: string) => {
    const { error } = await supabase.from("authorization_forms").delete().eq("id", id);
    if (error) { toast({ title: "Erreur", variant: "destructive" }); return; }
    setForms((prev) => prev.filter((f) => f.id !== id));
    toast({ title: "Formulaire supprimé ✅" });
  };

  // Canvas signature handling
  const startDrawing = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, []);

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "hsl(var(--foreground))";
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [isDrawing]);

  const stopDrawing = useCallback(() => setIsDrawing(false), []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSign = async () => {
    if (!user || !signingForm || !parentName.trim() || !childName.trim()) {
      toast({ title: "Remplissez tous les champs", variant: "destructive" });
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const signatureData = canvas.toDataURL("image/png");

    // Check if canvas is empty
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const hasContent = pixels.some((_, i) => i % 4 === 3 && pixels[i] > 0);
    if (!hasContent) {
      toast({ title: "Veuillez signer dans le cadre", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("authorization_signatures").insert({
        form_id: signingForm.id,
        parent_name: parentName.trim(),
        child_name: childName.trim(),
        signature_data: signatureData,
        user_id: user.id,
      });
      if (error) throw error;
      toast({ title: "Signature enregistrée ✅" });
      setSigningForm(null);
      setParentName("");
      setChildName("");
      fetchForms();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const viewSignatures = async (formId: string) => {
    setViewingSignatures(formId);
    const { data } = await supabase
      .from("authorization_signatures")
      .select("*")
      .eq("form_id", formId)
      .order("signed_at", { ascending: false });
    setSignatures(data ?? []);
  };

  return (
    <div className="min-h-screen bg-background safe-bottom">
      <PageHeader title="Autorisations" subtitle="Formulaires parentaux" />

      <main className="px-4 py-4 max-w-lg mx-auto space-y-3">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>
        ) : forms.length === 0 ? (
          <div className="text-center py-12">
            <FileCheck size={40} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Aucun formulaire d'autorisation.</p>
            {isAdmin && <p className="text-xs text-muted-foreground mt-1">Créez-en un avec le bouton +</p>}
          </div>
        ) : (
          forms.map((form, i) => (
            <motion.div
              key={form.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-card rounded-2xl p-4 border border-border shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      {FORM_TYPES.find((t) => t.value === form.form_type)?.label || form.form_type}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{form.title}</p>
                  {form.description && <p className="text-xs text-muted-foreground">{form.description}</p>}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button onClick={() => viewSignatures(form.id)} className="flex items-center gap-1 text-xs text-primary font-medium">
                      <Users size={14} /> {form.signature_count} signature{(form.signature_count || 0) > 1 ? "s" : ""}
                    </button>
                  )}
                  {!isAdmin && (
                    <span className="text-xs text-muted-foreground">{form.signature_count} signature{(form.signature_count || 0) > 1 ? "s" : ""}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button onClick={() => handleDeleteForm(form.id)} className="p-2 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition">
                      <Trash2 size={14} />
                    </button>
                  )}
                  {!form.signed_by_me ? (
                    <button
                      onClick={() => setSigningForm(form)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold"
                    >
                      <Pen size={14} /> Signer
                    </button>
                  ) : (
                    <span className="text-xs text-primary font-medium px-3 py-2 bg-primary/10 rounded-xl">✅ Signé</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </main>

      {/* Admin FAB */}
      {isAdmin && (
        <button onClick={() => setShowCreate(true)}
          className="fixed right-4 bottom-24 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform">
          <Plus size={24} />
        </button>
      )}

      {/* Create form drawer */}
      <AnimatePresence>
        {showCreate && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-foreground/40 z-50" onClick={() => setShowCreate(false)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[80] bg-background rounded-t-3xl flex flex-col max-h-[85dvh]">
              <div className="flex items-center justify-between p-6 pb-2">
                <h2 className="text-lg font-bold">Nouveau formulaire</h2>
                <button onClick={() => setShowCreate(false)}><X size={20} className="text-muted-foreground" /></button>
              </div>
              <form className="flex flex-col flex-1 overflow-hidden" onSubmit={handleCreateForm}>
                <div className="space-y-4 px-6 py-2 overflow-auto flex-1 pb-28">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">Type</label>
                    <select
                      value={formData.form_type}
                      onChange={(e) => setFormData({ ...formData, form_type: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {FORM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">Titre</label>
                    <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Ex: Sortie au parc du 20 mars" required
                      className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">Description</label>
                    <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Détails du formulaire…"
                      className="w-full min-h-[80px] px-4 py-3 rounded-xl bg-secondary text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50" />
                  </div>
                </div>
                <div className="sticky bottom-0 border-t border-border bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
                  <button type="submit" disabled={submitting}
                    className="w-full rounded-2xl bg-primary text-primary-foreground py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                    {submitting ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                    {submitting ? "Création…" : "Créer le formulaire"}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Signing drawer */}
      <AnimatePresence>
        {signingForm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-foreground/40 z-50" onClick={() => setSigningForm(null)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[80] bg-background rounded-t-3xl flex flex-col max-h-[90dvh]">
              <div className="flex items-center justify-between p-6 pb-2">
                <h2 className="text-lg font-bold">Signer : {signingForm.title}</h2>
                <button onClick={() => setSigningForm(null)}><X size={20} className="text-muted-foreground" /></button>
              </div>
              <div className="space-y-4 px-6 py-2 overflow-auto flex-1 pb-28">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Nom du parent</label>
                  <input type="text" value={parentName} onChange={(e) => setParentName(e.target.value)}
                    placeholder="Nom complet du parent" required maxLength={100}
                    className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Nom de l'enfant</label>
                  <input type="text" value={childName} onChange={(e) => setChildName(e.target.value)}
                    placeholder="Nom complet de l'enfant" required maxLength={100}
                    className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Signature</label>
                  <div className="relative rounded-xl border-2 border-dashed border-border bg-card">
                    <canvas
                      ref={canvasRef}
                      width={350}
                      height={150}
                      className="w-full touch-none cursor-crosshair"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                    <button type="button" onClick={clearCanvas}
                      className="absolute top-2 right-2 text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-lg">
                      Effacer
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Signez avec votre doigt ou souris dans le cadre ci-dessus</p>
                </div>
              </div>
              <div className="sticky bottom-0 border-t border-border bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
                <button onClick={handleSign} disabled={submitting}
                  className="w-full rounded-2xl bg-primary text-primary-foreground py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <Pen size={18} />}
                  {submitting ? "Envoi…" : "Valider la signature"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* View signatures modal */}
      <AnimatePresence>
        {viewingSignatures && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-foreground/40 z-50" onClick={() => setViewingSignatures(null)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[80] bg-background rounded-t-3xl flex flex-col max-h-[85dvh]">
              <div className="flex items-center justify-between p-6 pb-2">
                <h2 className="text-lg font-bold">Signatures ({signatures.length})</h2>
                <button onClick={() => setViewingSignatures(null)}><X size={20} className="text-muted-foreground" /></button>
              </div>
              <div className="overflow-auto flex-1 px-6 pb-8 space-y-4">
                {signatures.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aucune signature</p>}
                {signatures.map((sig) => (
                  <div key={sig.id} className="bg-secondary rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span><strong>Parent :</strong> {sig.parent_name}</span>
                      <span className="text-xs text-muted-foreground">{new Date(sig.signed_at).toLocaleDateString("fr-FR")}</span>
                    </div>
                    <p className="text-sm"><strong>Enfant :</strong> {sig.child_name}</p>
                    <img src={sig.signature_data} alt="Signature" className="h-16 bg-white rounded-lg border border-border" />
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Authorizations;
