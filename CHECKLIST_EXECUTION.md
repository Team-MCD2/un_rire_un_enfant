# 🎯 CHECKLIST D'EXÉCUTION - Plan de Refronte

**Créé:** 30 mai 2026  
**Statut:** À démarrer  
**Progression globale:** 0% (0/64h)

---

## PHASE 1️⃣: FONDATIONS BD (16h)

### 1.1 - Créer migration `contact_requests` (2h)
- [ ] Créer fichier `supabase/migrations/20260530_add_contact_requests.sql`
- [ ] Copier code SQL de PLAN_REFRONTE.md
- [ ] Exécuter: `supabase db push`
- [ ] Vérifier dans Supabase dashboard
- **Status:** ⏳ Pas commencé
- **ETA:** J1 matin

```bash
# Commande:
supabase migration new add_contact_requests
# Puis ajouter le SQL du plan
supabase db push
```

---

### 1.2 - Créer migration `notifications` (3h)
- [ ] Créer fichier `supabase/migrations/20260530_add_notifications.sql`
- [ ] Inclure table notifications + notification_preferences
- [ ] Inclure fonction trigger auto-create preferences
- [ ] Exécuter: `supabase db push`
- [ ] Vérifier 2 tables créées
- **Status:** ⏳ Pas commencé
- **ETA:** J1 midi

```bash
# Commande:
supabase migration new add_notifications
supabase db push
# Vérifier:
supabase db list
```

---

### 1.3 - Créer migration `blog_comments` (2h)
- [ ] Créer fichier `supabase/migrations/20260530_add_blog_comments.sql`
- [ ] Ajouter table avec RLS policies
- [ ] Exécuter: `supabase db push`
- **Status:** ⏳ Pas commencé
- **ETA:** J1 soir

```bash
supabase migration new add_blog_comments
supabase db push
```

---

### 1.4 - Améliorer `profiles` table (2h)
- [ ] Créer migration pour colonnes manquantes
- [ ] Ajouter: member_type, phone, bio, nickname, is_online, last_seen_at, status, preferences
- [ ] Exécuter push
- **Status:** ⏳ Pas commencé
- **ETA:** J1 soir

```bash
supabase migration new enhance_profiles
supabase db push
```

---

### 1.5 - Améliorer RLS sur toutes tables (5h)
- [ ] Créer migration `20260530_improve_rls.sql`
- [ ] Implémenter fonction `has_role()`
- [ ] Vérifier 25+ policies
- [ ] Exécuter push
- [ ] Tester chaque policy
- **Status:** ⏳ Pas commencé
- **ETA:** J2 complet

```bash
supabase migration new improve_rls
# Ajouter fonction has_role() et policies
supabase db push
# Tester:
supabase functions deploy
```

---

## PHASE 2️⃣: ROUTING & NAVIGATION (12h)

### 2.1 - Ajouter route `/ideas` (2h)
- [ ] Éditer `src/App.tsx`
- [ ] Ajouter import: `import Ideas from "./pages/Ideas";`
- [ ] Ajouter route: `<Route path="/ideas" element={<Ideas />} />`
- [ ] Tester: `http://localhost:8080/ideas`
- **Status:** ⏳ Pas commencé
- **ETA:** J3 matin

```bash
# Fichier src/App.tsx ligne ~35:
# Ajouter:
import Ideas from "./pages/Ideas";

# Dans <Routes> ajouter:
<Route path="/ideas" element={<Ideas />} />
```

---

### 2.2 - Ajouter onglet "Idées" BottomNav (3h)
- [ ] Éditer `src/components/BottomNav.tsx`
- [ ] Importer: `import { Lightbulb } from "lucide-react";`
- [ ] Ajouter onglet au tableau `tabs`
- [ ] Tester affichage
- **Status:** ⏳ Pas commencé
- **ETA:** J3 midi

```bash
# Fichier src/components/BottomNav.tsx ligne ~6-12:
# Ajouter dans tabs array:
{ path: "/ideas", label: "Idées", icon: Lightbulb },
```

---

### 2.3 - Vérifier & Optimiser Ideas.tsx (4h)
- [ ] Ouvrir `src/pages/Ideas.tsx`
- [ ] Vérifier création d'idée
- [ ] Vérifier likes/dislikes
- [ ] Vérifier commentaires
- [ ] Vérifier suppression
- [ ] Tester tout en localhost
- **Status:** ⏳ Pas commencé
- **ETA:** J3 après-midi

```bash
# Tester sur localhost:8080/ideas
# Vérifier console pas d'erreurs
npm run lint src/pages/Ideas.tsx
```

---

### 2.4 - Créer page Stories.tsx (optionnel) (3h)
- [ ] Créer `src/pages/Stories.tsx`
- [ ] Réutiliser logique StoriesBubbles.tsx
- [ ] Ajouter route dans App.tsx
- [ ] Tester affichage
- **Status:** ⏳ À considérer
- **ETA:** J3 soir (optionnel)

---

## PHASE 3️⃣: CORRECTIONS TYPESCRIPT (8h)

### 3.1 - Fixer `contact_requests as any` (3h)
- [ ] Éditer `src/components/BottomNav.tsx` ligne ~91
- [ ] Créer interface `ContactRequest`
- [ ] Remplacer `.from("contact_requests" as any)` par `.from("contact_requests")`
- [ ] Vérifier types TypeScript
- **Status:** ⏳ Pas commencé
- **ETA:** J3 soir

```bash
# Avant:
const { count } = await supabase
  .from("contact_requests" as any) // ❌ Mauvais

# Après:
interface ContactRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

const { count } = await supabase
  .from("contact_requests") // ✅ Bon
  .select("*", { count: "exact", head: true })
  .eq("receiver_id", user.id)
  .eq("status", "pending");
```

---

### 3.2 - Créer types.ts centralisé (3h)
- [ ] Créer `src/types/index.ts`
- [ ] Déplacer interfaces: ContactRequest, Notification, BlogComment, etc.
- [ ] Importer dans les pages
- [ ] Vérifier zéro warnings
- **Status:** ⏳ Pas commencé
- **ETA:** J4 matin

```bash
# Créer:
mkdir -p src/types
touch src/types/index.ts

# Puis refactoriser imports partout:
# Avant: interface Notification { ... }
# Après: import { Notification } from '@/types';
```

---

### 3.3 - Passer ESLint strict (2h)
- [ ] Augmenter strictitude ESLint
- [ ] Corriger tous warnings
- [ ] Build sans erreurs
- **Status:** ⏳ Pas commencé
- **ETA:** J4 midi

```bash
# Tester:
npm run lint
npm run build
# Doit être 100% clean
```

---

## PHASE 4️⃣: SYSTÈME NOTIFICATIONS (16h)

### 4.1 - Implémenter hook useNotifications (4h)
- [ ] Créer `src/hooks/useNotifications.ts`
- [ ] Implémenter fetch, subscribe, markAsRead
- [ ] Tester avec notifications en DB
- **Status:** ⏳ Pas commencé
- **ETA:** J4 après-midi

```bash
# Créer hook avec:
# - fetchNotifications()
# - useEffect subscription
# - markAsRead()
# Tester sur localhost:8080

npm run test src/hooks/useNotifications.ts
```

---

### 4.2 - Implémenter functions côté serveur (3h)
- [ ] Créer migration `20260530_notification_functions.sql`
- [ ] Implémenter:
  - `create_notification()`
  - `create_notification_with_preferences()`
- [ ] Push vers Supabase
- **Status:** ⏳ Pas commencé
- **ETA:** J5 matin

```bash
supabase migration new notification_functions
supabase db push
```

---

### 4.3 - Connecter triggers (4h)
- [ ] Créer migration `20260530_notification_triggers.sql`
- [ ] Implémenter 3 triggers:
  - Activity approved
  - Distribution created
  - Private message sent
- [ ] Tester chaque trigger
- **Status:** ⏳ Pas commencé
- **ETA:** J5 midi

```bash
supabase migration new notification_triggers
supabase db push

# Tester:
# 1. Créer activité → approuver → vérifier notification
# 2. Créer distribution → vérifier notifications massives
# 3. Envoyer message → vérifier notification
```

---

### 4.4 - Edge Function send-notifications (5h)
- [ ] Créer `supabase/functions/send-notifications/index.ts`
- [ ] Implémenter sendWebPush()
- [ ] Implémenter sendEmail()
- [ ] Déployer: `supabase functions deploy`
- [ ] Tester d'un client
- **Status:** ⏳ Pas commencé
- **ETA:** J5 soir

```bash
supabase functions new send-notifications
# Copier code du plan
supabase functions deploy send-notifications
```

---

## PHASE 5️⃣: TESTS & VALIDATION (12h)

### 5.1 - Tests Fonctionnels (8h)
- [ ] Test 1: Proposition d'activité + notification
- [ ] Test 2: Validation activité + notif creator
- [ ] Test 3: Création distribution + notif to all
- [ ] Test 4: Chat realtime + réactions
- [ ] Test 5: Messages privés + notification
- [ ] Test 6: Blog (bénévole only)
- [ ] Test 7: Boîte à idées (CRUD)
- [ ] Test 8: Stories (24h)
- [ ] Test 9: Autorisations parentales
- [ ] Test 10: Dons + classement
- [ ] Test 11: Chatbot "Nino"
- [ ] Test 12: Profil + préférences
- **Status:** ⏳ Pas commencé
- **ETA:** J6 complet

```bash
# Pour chaque test, vérifier:
# ✓ Fonctionnalité fonctionne
# ✓ Pas d'erreurs console
# ✓ RLS respectée
# ✓ Performance acceptable
```

---

### 5.2 - Tests PWA (2h)
- [ ] Installation desktop
- [ ] Installation mobile
- [ ] Mode offline
- [ ] Notifications push
- **Status:** ⏳ Pas commencé
- **ETA:** J7 matin

```bash
# Sur Chrome:
# - Menu 3 points > Installer l'app
# - Vérifier installée
# - Désactiver internet
# - Vérifier cache fonctionne
```

---

### 5.3 - Tests Sécurité (2h)
- [ ] Admin accès `/admin` ✓
- [ ] Non-admin accès refusé `/admin` ✓
- [ ] Bénévole voit `/blog` ✓
- [ ] Non-bénévole pas `/blog` ✓
- [ ] Messages privés isolés ✓
- [ ] RLS policies testées ✓
- **Status:** ⏳ Pas commencé
- **ETA:** J7 midi

```bash
# Tester chaque scénario
# Ouvrir DevTools > Network
# Vérifier aucune donnée non-autorisée
```

---

### 5.4 - Performance (monitoring continu)
- [ ] FCP < 2s
- [ ] TTI < 4s
- [ ] Pas de memory leaks
- [ ] Zéro erreurs console
- **Status:** ⏳ À monitorer
- **ETA:** Continu

```bash
# Utiliser:
# - Chrome DevTools > Performance
# - Lighthouse
# - Sentry pour production
```

---

## PHASE 6️⃣: DOCUMENTATION & DÉPLOIEMENT (8h)

### 6.1 - Documentation Technique (3h)
- [ ] Créer `docs/ARCHITECTURE.md`
- [ ] Documenter architecture
- [ ] Documenter BD schema
- [ ] Documenter flux auth
- [ ] Documenter notifications
- **Status:** ⏳ Pas commencé
- **ETA:** J7 après-midi

```bash
mkdir -p docs
touch docs/ARCHITECTURE.md
# Documenter structure du projet
```

---

### 6.2 - Guide Admin (2h)
- [ ] Créer `docs/GUIDE_ADMIN.md`
- [ ] Documenter gestion utilisateurs
- [ ] Documenter workflow validation
- [ ] Documenter modération
- **Status:** ⏳ Pas commencé
- **ETA:** J7 soir

```bash
touch docs/GUIDE_ADMIN.md
# Inclure screenshots et tutorials
```

---

### 6.3 - Déploiement Production (2h)
- [ ] Vérifier env vars Supabase
- [ ] Build final: `npm run build`
- [ ] Tester preview
- [ ] Deploy sur Lovable
- [ ] Vérifier production 24h
- **Status:** ⏳ Pas commencé
- **ETA:** J8 matin

```bash
# Vérifier:
npm run build
npm run lint
npm run test

# Déployer:
# Via interface Lovable ou:
git push origin main
```

---

### 6.4 - Monitoring (1h)
- [ ] Configurer Sentry
- [ ] Alertes email admin
- [ ] Dashboard monitoring
- [ ] Status page
- **Status:** ⏳ Pas commencé
- **ETA:** J8 midi

---

## 📊 RÉSUMÉ PROGRESSION

| Phase | Tâches | Heures | Status |
|-------|--------|--------|--------|
| 1️⃣ BD | 5/5 | 16h | ⏳ |
| 2️⃣ Navigation | 4/4 | 12h | ⏳ |
| 3️⃣ TypeScript | 3/3 | 8h | ⏳ |
| 4️⃣ Notifications | 4/4 | 16h | ⏳ |
| 5️⃣ Tests | 4/4 | 12h | ⏳ |
| 6️⃣ Docs | 4/4 | 8h | ⏳ |
| **TOTAL** | **24/24** | **64h** | **0%** |

---

## 🎯 COMMANDES RAPIDES (COPIER/COLLER)

### Jour 1 - Migrations BD
```bash
cd C:\Users\PC\Desktop\rire\project-export
supabase migration new add_contact_requests
supabase migration new add_notifications
supabase migration new add_blog_comments
supabase migration new enhance_profiles
supabase db push
```

### Jour 2 - RLS
```bash
supabase migration new improve_rls
supabase db push
supabase migration list
```

### Jour 3 - Routing
```bash
npm run lint src/App.tsx
npm run dev
# Tester http://localhost:8080/ideas
```

### Jour 4 - TypeScript
```bash
npm run lint
npm run lint --fix
npm run build
```

### Jour 5 - Notifications
```bash
npm run test
supabase functions list
supabase functions deploy send-notifications
```

### Jour 6-7 - Tests
```bash
npm run test:watch
npm run build
# Tests manuels via localhost:8080
```

### Jour 8 - Déploiement
```bash
npm run build
git status
git add .
git commit -m "Chore: 100% compliance refactor"
git push
# Lovable auto-deploys
```

---

**Créé:** 30 mai 2026  
**Prochaine mise à jour:** Chaque jour à la fin J
