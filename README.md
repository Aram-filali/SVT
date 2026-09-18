# Plateforme Pédagogique SVT — Socle Technique & Authentification (Phase 1)

Ce projet constitue le socle technique initial de la plateforme pédagogique pour l'enseignement des SVT (Sciences de la Vie et de la Terre). Il implémente une architecture modulaire propre, une base de données relationnelle sécurisée et un système complet d'authentification et de contrôle d'accès basé sur les rôles (RBAC).

---

## 1. Architecture Globale

Le projet est conçu comme un **monolithe modulaire** séparé en deux applications principales :

```
SVTFILALI/
├── backend/                   # API REST NestJS 12 (ESM, TypeScript, Vitest)
│   ├── src/
│   │   ├── auth/              # Module d'authentification (Register, Login, Refresh, Logout, Me)
│   │   ├── users/             # Module utilisateurs & routes de test RBAC
│   │   ├── prisma/            # Service d'accès à la base de données PostgreSQL
│   │   └── common/            # Guards, Decorators, Enums, Filters, Interfaces
│   ├── prisma/
│   │   ├── schema.prisma      # Modèle de données Prisma 7
│   │   ├── seed.ts            # Script d'initialisation des comptes de test
│   │   └── migrations/        # Historique des migrations versionnées
│   └── test/
│       └── auth.e2e-spec.ts   # Suite de tests E2E complète (30 tests)
├── frontend/                  # Application Next.js 16 (App Router, Tailwind CSS 4)
│   └── src/
│       ├── app/               # Pages: /login, /register, /me
│       └── lib/               # Client API avec gestion mémoire des tokens et cookies HttpOnly
├── docker-compose.yml         # Conteneur PostgreSQL 16
├── .env                       # Variables d'environnement locales
├── .env.example               # Template documenté des variables
└── README.md                  # Documentation technique complète
```

---

## 2. Technologies & Versions Utilisées

| Composant | Technologie | Version | Rôle |
|-----------|-------------|---------|------|
| **Runtime** | Node.js | v20.20.0 (LTS) | Exécution JavaScript/TypeScript |
| **Backend** | NestJS | 12.0.3 (ESM natif) | Framework API REST modulaire |
| **Frontend** | Next.js | 16.3.5 (Turbopack) | Interface utilisateur & App Router |
| **Styling** | Tailwind CSS | 4.x (CSS-first) | Styles minimalistes pour l'UI de test |
| **Base de Données** | PostgreSQL | 16-alpine (Docker) | SGBD relationnel |
| **ORM** | Prisma ORM | 7.10.0 | Modélisation, migrations et requêtage typé |
| **Pilote BD** | `@prisma/adapter-pg` + `pg` | Dernières stables | Adaptateur de connexion poolée |
| **Hashage Mots de Passe** | Argon2id (`argon2`) | Dernier stable | Hashage cryptographique résistant aux attaques GPU/ASIC |
| **Tokens** | `@nestjs/jwt` | 12.0.0 | Signature et vérification des Access Tokens |
| **Rate Limiting** | `@nestjs/throttler` | 6.x | Protection anti-bruteforce sur le login |
| **Validation** | `class-validator` / `class-transformer` | 0.14.x / 0.5.x | Validation stricte des DTOs en entrée |
| **Test Runner** | Vitest | 2.x | Exécution rapide des tests E2E |

---

## 3. Modèle de Données & Relations

### Architecture des Profils Utilisateurs

Conformément au cahier des charges, l'identité utilisateur commune est séparée des profils métiers :

```mermaid
erDiagram
    User ||--o| Student : "has profile"
    User ||--o| Parent : "has profile"
    User ||--o| Teacher : "has profile"
    User ||--o{ Session : "owns"
    Parent }|--|{ ParentStudent : "links to"
    Student }|--|{ ParentStudent : "linked by"

    User {
        string id PK
        string email UK
        string passwordHash
        string firstName
        string lastName
        Role role "STUDENT | PARENT | TEACHER | ADMIN"
        AccountStatus status "PENDING | ACTIVE | SUSPENDED | ARCHIVED"
        string phone "nullable"
        datetime createdAt
        datetime updatedAt
    }

    Student {
        string id PK
        string userId FK,UK
        string level "nullable"
        string section "nullable"
    }

    Parent {
        string id PK
        string userId FK,UK
    }

    Teacher {
        string id PK
        string userId FK,UK
        string bio "nullable"
    }

    ParentStudent {
        string id PK
        string parentId FK
        string studentId FK
    }

    Session {
        string id PK
        string userId FK
        string refreshTokenHash
        datetime expiresAt
        datetime revokedAt "nullable"
        datetime lastUsedAt
    }
```

### Règles d'Intégrité Référentielle
- `User.email` : Contrainte `@unique` en base de données.
- `ParentStudent` : Clé unique composite `@@unique([parentId, studentId])` pour éviter les doublons dans les liaisons parent-enfant.
- `Session` : Index sur `userId` pour des recherches rapides de sessions actives.
- Relations de suppression : `Cascade` pour supprimer les profils et sessions orphelins si un utilisateur est supprimé (bien que la règle métier privilégie la désactivation via `status=SUSPENDED` ou `ARCHIVED`).

---

## 4. Fonctionnement de l'Authentification & Sécurité

### 4.1 Inscription (`POST /auth/register`)
- Accessible publiquement (`@Public()`).
- Réservée exclusivement aux rôles `STUDENT` et `PARENT`. Toute tentative d'inscription avec `TEACHER` ou `ADMIN` est rejetée avec un code **HTTP 400 Bad Request**.
- Les comptes créés publiquement reçoivent obligatoirement le statut `PENDING`.
- Le mot de passe est validé (longueur minimale 8 caractères, au moins 1 majuscule, 1 minuscule, 1 chiffre, 1 caractère spécial) et hashé avec **Argon2id**.
- Un email déjà existant retourne **HTTP 409 Conflict**.

### 4.2 Connexion (`POST /auth/login`)
- Vérification des identifiants (email insensible à la casse et mot de passe).
- Si l'utilisateur n'existe pas ou si le mot de passe est invalide : retour **HTTP 401 Unauthorized** avec un message générique pour empêcher l'énumération des comptes.
- Si les identifiants sont corrects mais que le compte n'est pas `ACTIVE` :
  - Statut `PENDING` : retour **HTTP 403 Forbidden** (*Account is pending activation*).
  - Statut `SUSPENDED` : retour **HTTP 403 Forbidden** (*Account is suspended*).
  - Statut `ARCHIVED` : retour **HTTP 403 Forbidden** (*Account is archived*).
- Si `ACTIVE` :
  1. Génération d'un **Access Token JWT** court (15 minutes).
  2. Génération d'un **Refresh Token cryptographique opaque** (`crypto.randomBytes(64).toString('hex')`).
  3. Stockage du hash **SHA-256** du refresh token dans la table `Session` (expiration à 7 jours).
  4. Envoi du refresh token dans un cookie **HttpOnly** (`SameSite=Lax`, `Path=/auth/refresh`).
  5. Retour de l'access token et du profil utilisateur dans la réponse JSON.

### 4.3 Renouvellement de Session avec Rotation (`POST /auth/refresh`)
- Le refresh token est extrait du cookie HttpOnly de la requête.
- Le hash SHA-256 est calculé et recherché en base dans la table `Session`.
- **Détection de réutilisation** : Si un token déjà révoqué est soumis, toutes les sessions actives de l'utilisateur sont immédiatement révoquées (protection contre le vol de token).
- Si la session est valide et non expirée :
  1. La session précédente est révoquée (`revokedAt = now()`).
  2. Une nouvelle session est créée avec un nouveau refresh token opaque.
  3. Un nouvel access token est émis.
  4. Le nouveau cookie HttpOnly est positionné.

### 4.4 Déconnexion (`POST /auth/logout`)
- La session associée au refresh token est révoquée en base.
- Le cookie `refresh_token` est purgé du navigateur.

### 4.5 Vérification de Statut en Temps Réel (`AuthGuard`)
- Le statut (`ACTIVE`, `SUSPENDED`, etc.) n'est **PAS** encodé dans le payload JWT.
- À chaque requête protégée, l'`AuthGuard` vérifie la signature du token, extrait le `sub` (userId), charge l'utilisateur en base et valide que son statut est toujours `ACTIVE`.
- Cela garantit qu'un utilisateur suspendu ou archivé par l'administration est immédiatement bloqué sans attendre l'expiration de son JWT.

---

## 5. Stratégie de Stockage Frontend & CSRF

### Stockage des Tokens
- **Access Token** : Stocké **en mémoire JavaScript** (variable fermée dans `src/lib/api.ts`). Jamais persisté dans `localStorage` ni `sessionStorage` pour éliminer les risques de vol via injection XSS.
- **Refresh Token** : Stocké dans un cookie **HttpOnly**, avec attributs `SameSite=Lax` et `Path=/auth/refresh`.

### Protection CSRF
- L'Access Token étant transmis via le header HTTP `Authorization: Bearer <token>`, les requêtes protégées normales sont intrinsèquement immunisées contre les attaques CSRF (les requêtes forgées par un site tiers ne peuvent pas lire ni injecter ce header).
- L'endpoint `POST /auth/refresh` utilise un cookie HttpOnly avec `SameSite=Lax`. Dans les navigateurs modernes, `SameSite=Lax` empêche l'envoi du cookie lors de requêtes cross-site POST initiées par des domaines tiers.
- Pour la communication locale cross-origin (`localhost:3000` vers `localhost:3001`), CORS est configuré avec `origin: 'http://localhost:3000'` et `credentials: true`.

---

## 6. Contrôle d'Accès basé sur les Rôles (RBAC)

Le système sépare strictement l'authentification (*Qui est connecté ?*) de l'autorisation (*Qu'a-t-il le droit de faire ?*).

### Décorateur `@Roles(...)` & `RolesGuard`
- Le décorateur `@Roles(Role.TEACHER, Role.ADMIN)` applique les métadonnées de rôle sur les contrôleurs ou les méthodes.
- Le `RolesGuard` vérifie que le rôle porté par `request.user` appartient à la liste autorisée.
- En cas de non-concordance : retour **HTTP 403 Forbidden** (*Insufficient permissions*).

### Routes de Test RBAC Disponibles
| Endpoint | Méthode | Rôle Requis | Description |
|----------|---------|-------------|-------------|
| `/users/test/student-only` | GET | `STUDENT` | Accès réservé aux élèves |
| `/users/test/parent-only` | GET | `PARENT` | Accès réservé aux parents |
| `/users/test/teacher-only` | GET | `TEACHER` | Accès réservé aux professeurs |
| `/users/test/admin-only` | GET | `ADMIN` | Accès réservé aux administrateurs |

---

## 7. Protection Rate Limiting

- Configuré via `@nestjs/throttler`.
- Sur l'endpoint `POST /auth/login` : **5 tentatives par tranche de 15 minutes par IP**.
- En cas de dépassement : code **HTTP 429 Too Many Requests**.

---

## 8. Codes HTTP Utilisés

| Code HTTP | Signification | Cas d'Usage |
|-----------|---------------|-------------|
| **200 OK** | Succès | `GET /auth/me`, routes protégées, `POST /auth/logout` |
| **201 Created** | Ressource créée | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh` |
| **400 Bad Request** | Requête invalide | DTO invalide, mot de passe trop court, rôle non autorisé |
| **401 Unauthorized** | Non authentifié | Identifiants incorrects, token manquant, token invalide/expiré |
| **403 Forbidden** | Non autorisé | Rôle insuffisant, compte `PENDING`, `SUSPENDED` ou `ARCHIVED` |
| **409 Conflict** | Conflit d'unicité | Email déjà enregistré lors de l'inscription |
| **429 Too Many Requests** | Rate limit dépassé | Plus de 5 tentatives de connexion en 15 minutes |

---

## 9. Comptes de Test (Seed de Développement)

Les comptes suivants sont initialisés dans la base de données via le script `prisma/seed.ts` avec des mots de passe fictifs dédiés au développement :

| Rôle | Email | Mot de passe | Statut | Liaison / Détails |
|------|-------|--------------|--------|-------------------|
| **ADMIN** | `admin@svt.dev` | `Admin123!` | `ACTIVE` | Accès global |
| **TEACHER** | `teacher@svt.dev` | `Teacher123!` | `ACTIVE` | Profil Teacher associé |
| **PARENT** | `parent@svt.dev` | `Parent123!` | `ACTIVE` | Lié à `student@svt.dev` via `ParentStudent` |
| **STUDENT** | `student@svt.dev` | `Student123!` | `ACTIVE` | Lié à `parent@svt.dev` |
| **STUDENT** | `pending@svt.dev` | `Pending123!` | `PENDING` | Test refus d'accès pour compte non validé |
| **STUDENT** | `suspended@svt.dev` | `Suspended123!` | `SUSPENDED` | Test refus d'accès pour compte suspendu |
| **STUDENT** | `archived@svt.dev` | `Archived123!` | `ARCHIVED` | Test refus d'accès pour compte archivé |

---

## 10. Guide de Démarrage & Commandes

### Prérequis
- Node.js >= 20.19.0
- Docker Desktop
- npm >= 10.x

### 1. Démarrer PostgreSQL via Docker
```bash
# À la racine du projet
docker compose up -d
```
> Le port externe par défaut est configuré sur `5433` pour éviter les conflits avec un éventuel PostgreSQL local.

### 2. Configurer les Variables d'Environnement
Vérifiez que le fichier `.env` est présent à la racine et dans `backend/` :
```env
DATABASE_URL=postgresql://svt_user:svt_password@localhost:5433/svt_platform
JWT_ACCESS_SECRET=dev-access-secret-change-in-production-32chars!
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production-32chars
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION_DAYS=7
BACKEND_PORT=3001
CORS_ORIGIN=http://localhost:3000
```

### 3. Initialiser la Base de Données (Prisma)
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
```

### 4. Lancer les Tests Automatisés E2E
```bash
cd backend
npm run test:e2e
```
> Résultat attendu : 30 tests passés avec succès.

### 5. Démarrer le Backend
```bash
cd backend
npm run start:dev
# API disponible sur http://localhost:3001
```

### 6. Démarrer le Frontend
```bash
cd frontend
npm install
npm run dev
# Application accessible sur http://localhost:3000
```

---

## 11. Ce qui n'a volontairement PAS été implémenté en Phase 1

Conformément aux instructions strictes de limitation du périmètre :
- Pas d'entités métier avancées : `Group`, `Enrollment`, `Session`, `Attendance`, `Resource`, `Assessment`, `Grade`, `Payment`, `Notification`.
- Pas de services tiers : WhatsApp Business API, visioconférence WebRTC/Zoom, processeur de paiement.
- Pas d'intelligence artificielle : RAG, vector database, modèles de langage, fine-tuning.
- Pas de design graphique final ni de dashboards complets (seules les pages fonctionnelles `/login`, `/register`, `/me` ont été créées).
- Pas d'infrastructure superflue : Kubernetes, Kafka, Redis/BullMQ.

Ces modules seront développés de manière itérative lors des phases ultérieures, sur la base de ce socle technique validé.
