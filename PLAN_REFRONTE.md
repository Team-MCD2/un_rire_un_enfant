# 🚀 PLAN DE REFRONTE - Rire pour 1 enfant

**Objectif:** Atteindre 100% de conformité au cahier des charges  
**Statut actuel:** 73% opérationnel  
**Effort total estimé:** 8 jours (64 heures)  
**Date de démarrage:** 30 mai 2026  
**Date cible:** 6 juin 2026  

---

## 📊 VISION GLOBALE

```
Phase 1: Fondations (J1-J2) — 16h
├─ Migrations BD manquantes
├─ Création tables contact_requests, notifications, blog_comments
└─ RLS policies

Phase 2: Routing & Navigation (J3) — 12h
├─ Ajouter route /ideas
├─ Ajouter onglet Idées dans BottomNav
└─ Intégration complète Boîte à idées

Phase 3: Corrections TypeScript (J3-J4) — 8h
├─ Fixer contact_requests as any
├─ Typer correctement tous les imports
└─ Tests linting

Phase 4: Système de Notifications (J4-J5) — 16h
├─ Implémenter table notifications complète
├─ Préférences granulaires
├─ Notifications in-app + push
└─ Email automatiques

Phase 5: Tests & Validation (J5-J6) — 12h
├─ Tests fonctionnels (12 scénarios)
├─ Tests PWA (offline, push)
├─ Tests de sécurité (RLS)
└─ Tests de performance

Phase 6: Documentation & Déploiement (J7-J8) — 8h
├─ README complet
├─ Guide admin
├─ Déploiement Lovable
└─ Monitoring en production
```

---

## PHASE 1️⃣: FONDATIONS BASE DE DONNÉES (16 heures)

### Tâche 1.1: Créer migration `contact_requests` ⏱️ 2h

**Fichier:** `supabase/migrations/20260530_add_contact_requests.sql`

```sql
-- Create contact_requests table
CREATE TABLE public.contact_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, rejected
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sender_id, receiver_id)
);

-- Enable RLS
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can create their own requests"
  ON public.contact_requests FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can view requests involving them"
  ON public.contact_requests FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can update requests involving them"
  ON public.contact_requests FOR UPDATE
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

CREATE POLICY "Users can delete their own requests"
  ON public.contact_requests FOR DELETE
  USING (auth.uid() = sender_id);

-- Index pour performance
CREATE INDEX idx_contact_requests_receiver ON public.contact_requests(receiver_id, status);
CREATE INDEX idx_contact_requests_sender ON public.contact_requests(sender_id, status);
```

**Étapes:**
- [ ] Créer le fichier SQL
- [ ] Push vers Supabase (via CLI: `supabase db push`)
- [ ] Vérifier table créée dans Supabase dashboard
- [ ] Confirmer RLS activé

---

### Tâche 1.2: Créer migration `notifications` ⏱️ 3h

**Fichier:** `supabase/migrations/20260530_add_notifications.sql`

```sql
-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- activity_approved, distribution_created, new_message, etc.
  title TEXT NOT NULL,
  content TEXT,
  actor_id UUID REFERENCES auth.users(id), -- qui a généré la notif
  related_id UUID, -- ID de l'activité/message/etc.
  read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can only see their notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true); -- À restreindre via RLS DEFINER function

CREATE POLICY "Users can update their notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, read, created_at DESC);
CREATE INDEX idx_notifications_type ON public.notifications(type);

-- Create notification preferences table
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  activities_enabled BOOLEAN DEFAULT true,
  distributions_enabled BOOLEAN DEFAULT true,
  messages_enabled BOOLEAN DEFAULT true,
  stories_enabled BOOLEAN DEFAULT true,
  chat_mentions_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can only see their preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their preferences"
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-create preferences on signup
CREATE OR REPLACE FUNCTION public.create_notification_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_preferences
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_notification_preferences();
```

**Étapes:**
- [ ] Créer le fichier SQL
- [ ] Inclure fonction trigger pour auto-création préférences
- [ ] Push vers Supabase
- [ ] Vérifier 2 tables créées + trigger fonctionne
- [ ] Tester avec nouvel utilisateur

---

### Tâche 1.3: Créer migration `blog_comments` explicite ⏱️ 2h

**Fichier:** `supabase/migrations/20260530_add_blog_comments.sql`

```sql
-- Create explicit blog_comments table
CREATE TABLE public.blog_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can read blog comments"
  ON public.blog_comments FOR SELECT
  USING (true);

CREATE POLICY "Users can create comments on blog posts"
  ON public.blog_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON public.blog_comments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments or admins can delete any"
  ON public.blog_comments FOR DELETE
  USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Indexes
CREATE INDEX idx_blog_comments_post ON public.blog_comments(post_id, created_at DESC);
CREATE INDEX idx_blog_comments_user ON public.blog_comments(user_id);
```

**Étapes:**
- [ ] Créer le fichier SQL
- [ ] Push vers Supabase
- [ ] Vérifier table créée et RLS correctement

---

### Tâche 1.4: Ajouter colonne `member_status` à `profiles` ⏱️ 2h

**Fichier:** `supabase/migrations/20260530_enhance_profiles.sql`

```sql
-- Add missing columns to profiles if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS member_type TEXT DEFAULT 'user'; -- user, benevole, both
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE;

-- Améliorer profiles table avec plus d'infos
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'; -- active, banned, deleted
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';
```

**Étapes:**
- [ ] Créer migration
- [ ] Push vers Supabase
- [ ] Vérifier colonnes ajoutées
- [ ] Pas d'erreur sur colonnes existantes

---

### Tâche 1.5: Améliorer RLS sur toutes les tables ⏱️ 5h

**Fichier:** `supabase/migrations/20260530_improve_rls.sql`

```sql
-- Helper function for role checking
CREATE OR REPLACE FUNCTION public.has_role(user_id UUID, role_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = user_id AND role = role_name
  );
END;
$$;

-- Verify activity_proposals RLS
CREATE POLICY "Activity proposals - users see approved or own"
  ON public.activity_proposals FOR SELECT
  USING (
    status = 'approved' OR 
    auth.uid() = user_id OR 
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Activity proposals - users can create"
  ON public.activity_proposals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Activity proposals - users update own, admins all"
  ON public.activity_proposals FOR UPDATE
  USING (
    auth.uid() = user_id OR 
    public.has_role(auth.uid(), 'admin')
  );

-- Verify chat_rooms RLS
CREATE POLICY "Chat rooms - member can access"
  ON public.chat_rooms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.room_memberships
      WHERE room_id = chat_rooms.id 
        AND user_id = auth.uid()
        AND status = 'approved'
    ) OR public.has_role(auth.uid(), 'admin')
  );

-- Verify distributions RLS
CREATE POLICY "Distributions - authenticated can view"
  ON public.distributions FOR SELECT
  USING (auth.role() = 'authenticated');

-- Verify blog_posts RLS - bénévoles only
CREATE POLICY "Blog posts - benevoles can view"
  ON public.blog_posts FOR SELECT
  USING (
    public.has_role(auth.uid(), 'benevole') OR 
    public.has_role(auth.uid(), 'admin') OR
    auth.uid() = user_id
  );

CREATE POLICY "Blog posts - benevoles can create"
  ON public.blog_posts FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    (public.has_role(auth.uid(), 'benevole') OR 
     public.has_role(auth.uid(), 'both'))
  );
```

**Étapes:**
- [ ] Créer fichier migration
- [ ] Ajouter helper function `has_role()`
- [ ] Vérifier toutes les RLS policies (25+)
- [ ] Push vers Supabase
- [ ] Tester chaque policy avec utilisateur non-admin
- [ ] Tester avec admin
- [ ] Tester avec bénévole

---

## PHASE 2️⃣: ROUTING & NAVIGATION (12 heures)

### Tâche 2.1: Ajouter route `/ideas` à App.tsx ⏱️ 2h

**Fichier:** `src/App.tsx`

```typescript
// Ajouter import
import Ideas from "./pages/Ideas";

// Dans <Routes>
<Route path="/ideas" element={<Ideas />} />
```

**Vérification:**
- [ ] Import ajouté
- [ ] Route fonctionnelle
- [ ] Page accessible via `http://localhost:8080/ideas`
- [ ] Pas d'erreurs console

---

### Tâche 2.2: Ajouter onglet "Idées" à BottomNav.tsx ⏱️ 3h

**Fichier:** `src/components/BottomNav.tsx`

```typescript
// Mettre à jour le tableau tabs
const tabs = [
  { path: "/blog", label: "Aventure", icon: Image, benevoleOnly: true },
  { path: "/chat", label: "Chat", icon: MessageCircle },
  { path: "/", label: "Activités", icon: Calendar },
  { path: "/ideas", label: "Idées", icon: Lightbulb }, // NOUVEAU
  { path: "/documents", label: "Documents", icon: FileText, adminOnly: true },
  { path: "/distribution", label: "Repas", icon: UtensilsCrossed },
  { path: "/soutenir", label: "Soutenir", icon: Heart },
];
```

**Vérification:**
- [ ] Icon Lightbulb importée de lucide-react
- [ ] Onglet visible dans la barre nav
- [ ] Onglet actif au clic
- [ ] Responsive sur mobile

---

### Tâche 2.3: Vérifier et optimiser Ideas.tsx ⏱️ 4h

**Fichier:** `src/pages/Ideas.tsx`

**Checklist:**
- [ ] Affichage des idées depuis `idea_posts`
- [ ] Likes fonctionnels (table `idea_likes`)
- [ ] Commentaires fonctionnels (table `idea_comments`)
- [ ] Création d'idée avec image optionnelle
- [ ] Suppression par auteur ou admin
- [ ] Préchargement profils utilisateurs
- [ ] Pas d'erreurs TypeScript
- [ ] Animations fluides Framer Motion
- [ ] Responsive design

**Code à vérifier:**
```typescript
// Ideas.tsx doit avoir:
- Fetch idées avec préchargement profils
- States pour likes, commentaires, création
- Événements temps réel Supabase
- Gestion d'erreurs et loading
- RLS policies respectées
```

---

### Tâche 2.4: Ajouter route `/stories` (optionnel mais recommandé) ⏱️ 3h

**Rationale:** Cahier demande accès séparé aux stories, pas juste dans blog

**Fichier:** `src/pages/Stories.tsx`

```typescript
// Créer page dédiée aux stories
// Réutiliser logique de StoriesBubbles.tsx
// Affichage galerie + création
```

**Étapes:**
- [ ] Créer page Stories.tsx
- [ ] Ajouter route dans App.tsx
- [ ] Ajouter onglet dans BottomNav (optionnel)
- [ ] Tester affichage et création

---

## PHASE 3️⃣: CORRECTIONS TYPESCRIPT (8 heures)

### Tâche 3.1: Fixer `contact_requests` as any ⏱️ 3h

**Fichier:** `src/components/BottomNav.tsx`

**Avant:**
```typescript
const { count } = await supabase
  .from("contact_requests" as any)
  .select("*", { count: "exact", head: true })
  .eq("target_id", user.id)
  .eq("status", "pending");
```

**Après:**
```typescript
interface ContactRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

const { count } = await supabase
  .from("contact_requests")
  .select("*", { count: "exact", head: true })
  .eq("receiver_id", user.id)
  .eq("status", "pending");
```

**Étapes:**
- [ ] Créer interface `ContactRequest`
- [ ] Supprimer cast `as any`
- [ ] Vérifier types TypeScript
- [ ] Pas d'erreurs ESLint
- [ ] Tester fonctionnalité

---

### Tâche 3.2: Créer fichier types.ts centralisé ⏱️ 3h

**Fichier:** `src/types/index.ts`

```typescript
// Centraliser tous les types
export interface ContactRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  content?: string;
  actor_id?: string;
  related_id?: string;
  read: boolean;
  read_at?: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreference {
  activities_enabled: boolean;
  distributions_enabled: boolean;
  messages_enabled: boolean;
  stories_enabled: boolean;
  chat_mentions_enabled: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
}

export interface BlogComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// ...autres types
```

**Étapes:**
- [ ] Créer fichier types/index.ts
- [ ] Migrer tous les types des pages
- [ ] Importer depuis types/index.ts
- [ ] ESLint sans erreurs

---

### Tâche 3.3: Passer ESLint en full strict ⏱️ 2h

**Fichier:** `eslint.config.js`

**Étapes:**
- [ ] Augmenter niveau de strictitude ESLint
- [ ] Corriger tous les warnings
- [ ] Corriger types implicites `any`
- [ ] Tester build sans erreurs: `npm run build`
- [ ] Zero TypeScript errors

---

## PHASE 4️⃣: SYSTÈME NOTIFICATIONS (16 heures)

### Tâche 4.1: Implémenter hook `useNotifications` ⏱️ 4h

**Fichier:** `src/hooks/useNotifications.ts`

```typescript
import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useNotifications = () => {
  const { user } = useAuth();

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user) return [];
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    return data || [];
  }, [user]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return;
    
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        // Trigger re-render or toast
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Mark as read
  const markAsRead = useCallback(async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);
  }, []);

  return { fetchNotifications, markAsRead };
};
```

**Étapes:**
- [ ] Créer fichier useNotifications.ts
- [ ] Implémenter fetch, subscribe, markAsRead
- [ ] Tester avec notifications existantes
- [ ] Temps réel fonctionne

---

### Tâche 4.2: Implémenter `createNotification()` côté serveur ⏱️ 3h

**Fichier:** `supabase/migrations/20260530_notification_functions.sql`

```sql
-- Function to create notifications (use SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_content TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_related_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, content, actor_id, related_id)
  VALUES (p_user_id, p_type, p_title, p_content, p_actor_id, p_related_id)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- Function to check preferences before creating notification
CREATE OR REPLACE FUNCTION public.create_notification_with_preferences(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_content TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_related_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefs RECORD;
  v_enabled BOOLEAN;
BEGIN
  -- Check user preferences
  SELECT * INTO v_prefs 
  FROM public.notification_preferences 
  WHERE user_id = p_user_id;

  -- Determine if notification should be created based on type
  v_enabled := CASE p_type
    WHEN 'activity_approved' THEN v_prefs.activities_enabled
    WHEN 'distribution_created' THEN v_prefs.distributions_enabled
    WHEN 'new_message' THEN v_prefs.messages_enabled
    WHEN 'story_published' THEN v_prefs.stories_enabled
    WHEN 'chat_mention' THEN v_prefs.chat_mentions_enabled
    ELSE true
  END;

  IF v_enabled THEN
    RETURN public.create_notification(p_user_id, p_type, p_title, p_content, p_actor_id, p_related_id);
  END IF;
  
  RETURN NULL;
END;
$$;
```

**Étapes:**
- [ ] Créer migration avec fonctions
- [ ] Push vers Supabase
- [ ] Tester appels de fonction

---

### Tâche 4.3: Connecter triggers pour notifications auto ⏱️ 4h

**Fichier:** `supabase/migrations/20260530_notification_triggers.sql`

```sql
-- Trigger: Activité approuvée → notification au créateur
CREATE OR REPLACE FUNCTION public.notify_activity_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    PERFORM public.create_notification_with_preferences(
      NEW.user_id,
      'activity_approved',
      'Votre activité a été approuvée!',
      NEW.title,
      NULL,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_activity_approved
  AFTER UPDATE ON public.activity_proposals
  FOR EACH ROW EXECUTE FUNCTION public.notify_activity_approved();

-- Trigger: Nouvelle distribution → notifier utilisateurs inscrits
CREATE OR REPLACE FUNCTION public.notify_distribution_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Notifier tous les utilisateurs avec préférence activée
  INSERT INTO public.notifications (user_id, type, title, content, related_id)
  SELECT 
    p.id,
    'distribution_created',
    'Une nouvelle distribution est disponible',
    NEW.title,
    NEW.id
  FROM public.profiles p
  JOIN public.notification_preferences np ON np.user_id = p.id
  WHERE np.distributions_enabled = true;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_distribution_created
  AFTER INSERT ON public.distributions
  FOR EACH ROW EXECUTE FUNCTION public.notify_distribution_created();

-- Trigger: Message privé → notifier le destinataire
CREATE OR REPLACE FUNCTION public.notify_private_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.create_notification_with_preferences(
    NEW.receiver_id,
    'new_message',
    'Vous avez un nouveau message',
    NEW.content,
    NEW.sender_id,
    NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_private_message_created
  AFTER INSERT ON public.private_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_private_message();
```

**Étapes:**
- [ ] Créer migrations avec triggers
- [ ] Push vers Supabase
- [ ] Tester: créer activité → notification
- [ ] Tester: créer distribution → notification
- [ ] Tester: envoyer message privé → notification

---

### Tâche 4.4: Implémenter Edge Function `send-notifications` ⏱️ 5h

**Fichier:** `supabase/functions/send-notifications/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

serve(async (req) => {
  if (req.method === "POST") {
    const { type, userId, title, content, actorId, relatedId } = await req.json();

    try {
      // Create notification
      const { data, error } = await supabase
        .from("notifications")
        .insert({
          user_id: userId,
          type,
          title,
          content,
          actor_id: actorId,
          related_id: relatedId,
        })
        .select()
        .single();

      if (error) throw error;

      // Send push if subscribed
      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", userId);

      for (const sub of subscriptions || []) {
        // Send web push notification
        await sendWebPush(sub, title, content);
      }

      // Send email if enabled
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("email_enabled")
        .eq("user_id", userId)
        .single();

      if (prefs?.email_enabled) {
        await sendEmail(userId, title, content);
      }

      return new Response(JSON.stringify({ success: true, notification: data }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
});

async function sendWebPush(subscription: any, title: string, content: string) {
  // Implémentation Web Push API
  // Utiliser web-push library
}

async function sendEmail(userId: string, title: string, content: string) {
  // Appeler fonction send-email
  // Via Resend
}
```

**Étapes:**
- [ ] Créer fonction Edge
- [ ] Implémenter sendWebPush()
- [ ] Implémenter sendEmail()
- [ ] Déployer: `supabase functions deploy`
- [ ] Tester d'un client

---

## PHASE 5️⃣: TESTS & VALIDATION (12 heures)

### Tâche 5.1: Tests Fonctionnels (8h)

**Checklist complète à tester:**

1. ✅ **Proposition d'activité**
   - [ ] Formulaire valide avec lieu, date, météo
   - [ ] Notification email à l'admin
   - [ ] Admin peut valider/refuser
   - [ ] Créateur reçoit notification

2. ✅ **Distribution**
   - [ ] Admin crée distribution
   - [ ] Tous les utilisateurs reçoivent notification
   - [ ] Utilisateurs peuvent s'inscrire
   - [ ] Compteur de places se met à jour

3. ✅ **Chat**
   - [ ] Messages en temps réel (Realtime WebSocket)
   - [ ] Réactions emoji fonctionnent
   - [ ] Messages épinglés visibles
   - [ ] Édition/suppression fonctionne

4. ✅ **Messages Privés**
   - [ ] Envoi message → notification push
   - [ ] Marquer comme lu
   - [ ] Pastille "non lus" correcte

5. ✅ **Blog / Aventure**
   - [ ] Bénévoles peuvent publier
   - [ ] Non-bénévoles ne voient pas
   - [ ] Commentaires fonctionnent
   - [ ] Images uploadent correctement

6. ✅ **Boîte à Idées**
   - [ ] Créer idée (texte + image optionnelle)
   - [ ] Liker/unliker idée
   - [ ] Commenter idée
   - [ ] Supprimer propre idée ou admin supprime

7. ✅ **Stories**
   - [ ] Publient stories avec image
   - [ ] Affichage 24h max
   - [ ] Affichage fullscreen
   - [ ] Auto-suppression après 24h

8. ✅ **Autorisations Parentales**
   - [ ] Admin crée formulaire
   - [ ] Parent peut signer (tactile)
   - [ ] Signature stockée
   - [ ] Admin peut voir historique

9. ✅ **Dons**
   - [ ] Sélectionner montant
   - [ ] Classement donateurs
   - [ ] Trophée affiché

10. ✅ **Chatbot "Nino"**
    - [ ] Répond sur salons bénévoles
    - [ ] Repère keywords (horaires, prix, etc.)
    - [ ] Réponses personnalisables par admin

11. ✅ **Profil Utilisateur**
    - [ ] Éditer bio, photo, type membre
    - [ ] Préférences notifications
    - [ ] Statut en ligne

12. ✅ **Panel Admin**
    - [ ] Voir liste utilisateurs
    - [ ] Assigner rôles
    - [ ] Valider activités
    - [ ] Gérer salons chat
    - [ ] Voir messages support

---

### Tâche 5.2: Tests PWA (2h)

**Checklist:**
- [ ] Installation sur Chrome desktop fonctionne
- [ ] Installation sur Safari iOS fonctionne
- [ ] Mode offline fonctionne avec cache
- [ ] Service Worker met à jour correctement
- [ ] Notifications push reçues
- [ ] App prend 5-10 MB max

---

### Tâche 5.3: Tests Sécurité (2h)

**Checklist RLS:**
- [ ] Utilisateur non-admin ne voit pas `/admin`
- [ ] Utilisateur non-bénévole ne voit pas `/blog`
- [ ] Messages privés isolés par utilisateur
- [ ] Activités non-approuvées invisibles sauf au créateur
- [ ] Aucun accès direct aux IDs d'autres utilisateurs

**Checklist authentification:**
- [ ] Connexion avec email/password fonctionne
- [ ] Mot de passe oublié fonctionne
- [ ] Inscription fonctionne
- [ ] Tokens rafraîchis automatiquement
- [ ] Déconnexion fonctionne

---

### Tâche 5.4: Performance & Logs (0h - à monitorer)

**Métriques à vérifier:**
- [ ] First Contentful Paint < 2s
- [ ] Time to Interactive < 4s
- [ ] Pas d'erreurs console
- [ ] Pas de memory leaks
- [ ] Supabase logs clean

---

## PHASE 6️⃣: DOCUMENTATION & DÉPLOIEMENT (8 heures)

### Tâche 6.1: Documentation Technique ⏱️ 3h

**Fichier:** `docs/ARCHITECTURE.md`

Documenter:
- Architecture système
- Stack technologique
- Structure base de données
- Flux authentification
- Système notifications
- PWA setup
- RLS policies

---

### Tâche 6.2: Guide Admin ⏱️ 2h

**Fichier:** `docs/GUIDE_ADMIN.md`

Documenter:
- Comment gérer utilisateurs
- Workflow validation activités
- Configuration chatbot
- Modération messages
- Gestion distributions
- Voir statistiques

---

### Tâche 6.3: Déploiement Production ⏱️ 2h

**Étapes:**
- [ ] Vérifier env vars (Supabase keys, Resend API, etc.)
- [ ] Build final: `npm run build`
- [ ] Tester sur preview deploy
- [ ] Deploy sur Lovable: `lovable deploy`
- [ ] Vérifier en production
- [ ] Monitorer logs 24h

---

### Tâche 6.4: Monitoring & Support ⏱️ 1h

**Mettre en place:**
- [ ] Sentry pour error tracking
- [ ] Logtail ou similaire pour logs
- [ ] Alertes email admin
- [ ] Status page de l'app

---

## 📅 TIMELINE DÉTAILLÉE

| Jour | Activité | Durée | Responsable |
|-----|----------|-------|------------|
| **Jour 1** | Migrations BD (contact_requests, notifications, blog_comments) | 8h | Dev Senior |
| **Jour 2** | RLS policies + Enhanced Profiles | 8h | Dev Senior |
| **Jour 3** | Route /ideas + BottomNav + Corrections TS | 8h | Dev Full-Stack |
| **Jour 4** | Hook useNotifications + Edge Functions | 8h | Dev Backend |
| **Jour 5** | Triggers notifications + Notification System | 8h | Dev Backend |
| **Jour 6** | Tests fonctionnels complets (12 scénarios) | 8h | QA + Dev |
| **Jour 7** | Tests PWA + Sécurité + Performance | 8h | QA + Dev |
| **Jour 8** | Documentation + Déploiement + Support | 8h | Tech Lead |

**Total: 64 heures = 8 jours ouvrables**

---

## 🚨 RISQUES & MITIGATION

| Risque | Probabilité | Impact | Mitigation |
|--------|------------|--------|-----------|
| RLS policies complexes | Moyen | Haut | Tester chaque policy avec rôles différents |
| Notifications en doublon | Moyen | Moyen | Vérifier deduplication dans triggers |
| Edge Functions timeout | Bas | Haut | Tester timeout + async processing |
| PWA cache stale | Bas | Moyen | Implémenter cache versioning |
| Performance dégradée | Bas | Haut | Monitoring Sentry dès déploiement |

---

## ✅ CRITÈRES DE SUCCÈS

L'objectif **100% conformité** est atteint quand:

1. ✅ Route `/ideas` routée et fonctionnelle
2. ✅ Tables `contact_requests`, `notifications`, `blog_comments` créées + RLS
3. ✅ Système notifications complet (in-app, push, email)
4. ✅ Tous les 12 scénarios de test passent
5. ✅ Aucun TypeScript errors/warnings
6. ✅ RLS policies testées sur tous les rôles
7. ✅ PWA installable + offline
8. ✅ Zéro erreurs console en production
9. ✅ Documentation complète
10. ✅ Déploiement réussi sur Lovable

---

**Rapport généré:** 30 mai 2026  
**Plan validé par:** Architecture Team  
**Prochaine étape:** Kick-off Jour 1
