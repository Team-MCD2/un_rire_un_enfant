# ⚡ GUIDE DÉMARRAGE IMMÉDIAT - Jour 1

**Objectif:** Avancer de 73% → 85% conformité  
**Durée:** 8 heures (Jour 1)  
**Résultat attendu:** Toutes les migrations BD en place

---

## 📋 PRÉ-REQUIS

✅ Vérifier que vous avez:
- [ ] Accès au compte Supabase
- [ ] VS Code ouvert sur `project-export`
- [ ] Terminal CLI Supabase: `supabase --version`
- [ ] Git configuré: `git config user.name`

---

## ⏰ TIMELINE JOUR 1

```
08:00 - 10:00  Migration contact_requests (2h)
10:00 - 10:15  Pause ☕
10:15 - 13:00  Migration notifications (3h)
13:00 - 14:00  Déjeuner 🍽️
14:00 - 16:00  Migration blog_comments (2h)
16:00 - 16:15  Pause ☕
16:15 - 17:30  Migration enhance_profiles (2h)
17:30 - 18:00  Vérification & commit (1h)
```

---

## TÂCHE 1️⃣: MIGRATION `contact_requests` (2h)

### Étape 1.1: Créer le fichier migration

```bash
cd C:\Users\PC\Desktop\rire\project-export

# Créer une nouvelle migration
supabase migration new add_contact_requests
# Output: Created migration: supabase/migrations/20260530XXXXXX_add_contact_requests.sql
```

### Étape 1.2: Écrire le SQL

**Ouvrir:** `supabase/migrations/20260530XXXXXX_add_contact_requests.sql`

**Copier le contenu:**

```sql
-- Create contact_requests table for friend/contact requests
CREATE TABLE public.contact_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, rejected
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sender_id, receiver_id)
);

-- Enable Row Level Security
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can create contact requests"
  ON public.contact_requests FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can view contact requests involving them"
  ON public.contact_requests FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Receiver can update request status"
  ON public.contact_requests FOR UPDATE
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

CREATE POLICY "Sender can delete their requests"
  ON public.contact_requests FOR DELETE
  USING (auth.uid() = sender_id);

-- Performance indexes
CREATE INDEX idx_contact_requests_receiver_status ON public.contact_requests(receiver_id, status);
CREATE INDEX idx_contact_requests_sender_status ON public.contact_requests(sender_id, status);
```

### Étape 1.3: Push vers Supabase

```bash
# Vérifier la migration est correcte
supabase migration list
# Doit afficher: add_contact_requests (pending)

# Pousser
supabase db push
# Output: ✔ remote schema: 20260530XXXXXX_add_contact_requests applied successfully
```

### Étape 1.4: Vérifier

```bash
# Voir les migrations appliquées
supabase migration list
# Doit afficher: add_contact_requests (applied)

# Vérifier table créée
supabase db pull
# Ou vérifier dans Supabase dashboard
```

**✅ TÂCHE 1 TERMINÉE!**

**Temps écoulé:** 2h

---

## TÂCHE 2️⃣: MIGRATION `notifications` (3h)

### Étape 2.1: Créer migration

```bash
supabase migration new add_notifications
```

### Étape 2.2: Écrire le SQL (LONG!)

**Ouvrir:** `supabase/migrations/20260530XXXXXX_add_notifications.sql`

```sql
-- Create notifications table (in-app notifications)
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- activity_approved, distribution_created, new_message, chat_mention, story_published
  title TEXT NOT NULL,
  content TEXT,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- who triggered the notification
  related_id UUID, -- ID of activity/message/post/etc
  read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can only read their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their notifications (mark as read)"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Performance indexes
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, read, created_at DESC);
CREATE INDEX idx_notifications_type ON public.notifications(type);
CREATE INDEX idx_notifications_actor ON public.notifications(actor_id);

-- Create notification_preferences table
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

-- Enable RLS on preferences
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can only read their preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their preferences"
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Helper function to create notification preferences on signup
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

-- Trigger to auto-create preferences on signup
DROP TRIGGER IF EXISTS on_auth_user_created_preferences ON auth.users;
CREATE TRIGGER on_auth_user_created_preferences
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_notification_preferences();
```

### Étape 2.3: Push vers Supabase

```bash
supabase db push
# Deux tables créées
```

### Étape 2.4: Vérifier

```bash
# Vérifier en test
supabase db pull

# Ou aller dans Supabase > Tables
# Vérifier: notifications, notification_preferences
```

**✅ TÂCHE 2 TERMINÉE!**

**Temps écoulé:** 3h (Total: 5h)

---

## TÂCHE 3️⃣: MIGRATION `blog_comments` (2h)

### Étape 3.1: Créer migration

```bash
supabase migration new add_blog_comments
```

### Étape 3.2: Écrire le SQL

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

-- RLS Policies
CREATE POLICY "Anyone authenticated can read blog comments"
  ON public.blog_comments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create comments"
  ON public.blog_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON public.blog_comments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their comments or admins can delete any"
  ON public.blog_comments FOR DELETE
  USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Performance indexes
CREATE INDEX idx_blog_comments_post ON public.blog_comments(post_id, created_at DESC);
CREATE INDEX idx_blog_comments_user ON public.blog_comments(user_id);
```

### Étape 3.3: Push

```bash
supabase db push
```

**✅ TÂCHE 3 TERMINÉE!**

**Temps écoulé:** 2h (Total: 7h)

---

## TÂCHE 4️⃣: MIGRATION `enhance_profiles` (2h)

### Étape 4.1: Créer migration

```bash
supabase migration new enhance_profiles
```

### Étape 4.2: Écrire le SQL

```sql
-- Enhance profiles table with missing columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS member_type TEXT DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_member_type ON public.profiles(member_type);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_is_online ON public.profiles(is_online);
```

### Étape 4.3: Push

```bash
supabase db push
```

### Étape 4.4: Vérifier

```bash
# Dans Supabase dashboard
# Aller à: Tables > profiles
# Vérifier: nouvelles colonnes présentes
```

**✅ TÂCHE 4 TERMINÉE!**

**Temps écoulé:** 2h (Total: 9h)

---

## ✅ VÉRIFICATION FINALE

### Checklist Jour 1

```bash
# 1. Vérifier toutes migrations
supabase migration list
# Output devrait afficher 4 migrations "applied"

# 2. Vérifier les tables
supabase db pull

# 3. Vérifier RLS activé
# Dans Supabase Dashboard > Tables
# Chaque table doit avoir RLS: Enabled

# 4. Tester les tables existent
supabase db query "SELECT * FROM public.contact_requests LIMIT 1;"
supabase db query "SELECT * FROM public.notifications LIMIT 1;"
supabase db query "SELECT * FROM public.blog_comments LIMIT 1;"
supabase db query "SELECT * FROM public.profiles LIMIT 1;"
# Tous doivent retourner des résultats
```

---

## 💾 COMMIT & SAUVEGARDE

```bash
cd C:\Users\PC\Desktop\rire\project-export

# Vérifier status
git status

# Ajouter les migrations
git add supabase/migrations/

# Commit
git commit -m "Feat: Add database migrations for Phase 1

- Add contact_requests table with RLS
- Add notifications + notification_preferences tables
- Add blog_comments table with RLS
- Enhance profiles table with additional columns
- All tables: RLS enabled, indexes created

Conformité: 73% → 80%"

# Push
git push origin main
```

---

## 🎯 RÉSULTAT FIN JOUR 1

**Avant:** 73% conforme (0 tables manquantes)  
**Après:** 80% conforme (+4 tables, +RLS)

**Fichiers créés:**
- ✅ `supabase/migrations/20260530XXXXXX_add_contact_requests.sql`
- ✅ `supabase/migrations/20260530XXXXXX_add_notifications.sql`
- ✅ `supabase/migrations/20260530XXXXXX_add_blog_comments.sql`
- ✅ `supabase/migrations/20260530XXXXXX_enhance_profiles.sql`

**Tables créées:**
- ✅ `contact_requests` (avec RLS, indexes)
- ✅ `notifications` (avec RLS, indexes)
- ✅ `notification_preferences` (avec RLS, auto-create trigger)
- ✅ `blog_comments` (avec RLS, indexes)

**Colonnes ajoutées:**
- ✅ `profiles.member_type`
- ✅ `profiles.phone`
- ✅ `profiles.bio`
- ✅ `profiles.nickname`
- ✅ `profiles.is_online`
- ✅ `profiles.last_seen_at`
- ✅ `profiles.status`
- ✅ `profiles.preferences`

---

## 🚀 PROCHAINE ÉTAPE: JOUR 2

**Jour 2 - Matin (08:00)**

Vous allez:
1. ✅ Améliorer RLS sur toutes les tables (5h)
2. ✅ Créer fonction `has_role()` helper
3. ✅ Vérifier 25+ policies

**Préparez:**
- Consulter `PLAN_REFRONTE.md` section "Tâche 1.5"
- Avoir accès à Supabase dashboard
- Terminal prêt

---

**Rapport Jour 1:** Généré 30 mai 2026  
**Validation:** Migrations BD ✅  
**Prochaine mise à jour:** Soir Jour 1 (vérification)
