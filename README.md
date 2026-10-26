# Projet d'évaluation Docker

Ce projet est un squelette minimal pour l'évaluation Docker. Il comprend :

- **Frontend** : Application React 19 (Vite 8) qui affiche une instruction récupérée depuis le backend
- **Backend** : API Node.js/Express 5 qui lit l'instruction depuis PostgreSQL
- **Database** : Script SQL d'initialisation pour PostgreSQL 18

## Prérequis

- Node.js 24 LTS recommandé (minimum 22.12)
- npm
- PostgreSQL (en local ou via Docker pour les tests)

## Structure du projet

```
├── frontend/          # Application React (Vite)
├── backend/           # API Express
├── db/
│   └── init.sql       # Script d'initialisation PostgreSQL
└── README.md
```

## Installation et lancement

### 1. Base de données

Créez une base de données PostgreSQL et exécutez le script d'initialisation :

```bash
psql -U postgres -d evaluation -f db/init.sql
```

Ou si vous utilisez Docker pour PostgreSQL :

```bash
docker run -d \
  --name postgres-eval \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=evaluation \
  -p 5432:5432 \
  -v $(pwd)/db/init.sql:/docker-entrypoint-initdb.d/init.sql \
  postgres:18-alpine
```

### 2. Backend

```bash
cd backend

# Copier le fichier d'environnement
cp .env.example .env

# Éditer .env avec vos identifiants PostgreSQL
# DATABASE_URL=postgresql://postgres:password@localhost:5432/evaluation

# Installer les dépendances
npm install

# Lancer en mode développement (rechargement automatique via node --watch)
npm run dev
```

Le fichier `.env` est chargé nativement par Node.js (`--env-file-if-exists`) : pas besoin de `dotenv`. S'il est absent, les variables d'environnement du processus sont utilisées.

Le backend sera accessible sur `http://localhost:3001`.

### 3. Frontend

```bash
cd frontend

# Installer les dépendances
npm install

# Lancer en mode développement
npm run dev
```

Le frontend sera accessible sur `http://localhost:5173`.

Le frontend appelle l'API en relatif (`/api/...`). En développement, le serveur Vite relaie ces appels vers le backend (voir `server.proxy` dans `vite.config.js`). En production, c'est à vous de prévoir un point d'entrée qui fait la même chose (reverse proxy).

## Configuration

### Backend

Variables d'environnement (fichier `backend/.env`) :

| Variable | Description | Exemple |
|----------|-------------|---------|
| `DATABASE_URL` | URL de connexion PostgreSQL | `postgresql://postgres:password@localhost:5432/evaluation` |
| `PORT` | Port du serveur Express | `3001` |

### Frontend

Variables d'environnement (fichier `frontend/.env`, optionnel) :

| Variable | Description | Exemple |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | URL du backend, injectée **au build**. Vide par défaut : appels sur la même origine | *(vide)* ou `https://api.example.com` |
| `API_PROXY_TARGET` | Cible du proxy `/api` du serveur de dev Vite (variable du processus, pas du `.env`) | `http://localhost:3001` |

## Endpoints API

### GET /api/health

Vérifie que le backend répond et qu'il arrive à joindre la base de données.

**Réponse succès (200)** :
```json
{ "status": "ok", "database": "up" }
```

**Réponse erreur (503)** : base de données injoignable.
```json
{ "status": "error", "database": "down" }
```

### GET /api/instruction

Récupère la première instruction de la base de données.

**Réponse succès (200)** :
```json
{
  "id": 1,
  "message": "Réalise le docker-compose et branche le front sur le back. Bonne chance !",
  "created_at": "2026-09-28T12:00:00.000Z"
}
```

**Réponse erreur (404)** :
```json
{
  "error": "No instruction found"
}
```

## Schéma de la base de données

Table `instructions` :

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | SERIAL | Clé primaire auto-incrémentée |
| `message` | TEXT | Message de l'instruction |
| `created_at` | TIMESTAMPTZ | Date de création |

## Votre mission

**Vous devez créer les Dockerfiles et le compose.yaml pour conteneuriser cette application.**

Consultez le guide d'évaluation pour les exigences détaillées.

## PREUVES

Après la création des dockerfiles et de mon compose.yaml, et en créant des reseaux séparés (back_net; front_net) 
Je démarre mes conteneurs : docker compose up --build 
### Afin de vérifier qu'il fonctionne sur les bons réseaux, je ping la database depuis le conteneur "backend" (docker compose exec backend ping -c 1 db) : 
```
PING db (172.18.0.2): 56 data bytes
64 bytes from 172.18.0.2: seq=0 ttl=64 time=0.278 ms
```
### Afin de vérifier qu'il fonctionne sur les bons réseaux, je ping la database depuis le conteneur "frontend" (docker compose exec frontend ping -c 1 db) :

```
ping: bad address 'db'
```

C'est normal, frontend n'es pas sur le réseau de la database

### On verifie que la database ne communique pas avec internet : (docker compose exec db ping -c 1 -W 2 8.8.8.8)

```
PING 8.8.8.8 (8.8.8.8): 56 data bytes 
ping: sendto: Network unreachable
```

## Ajout d'un volume pour la persistence 

#### (docker compose exec db psql -U postgres -d evaluation -c "INSERT INTO instructions (message) VALUES ('Test de persistance');")
#### docker compose exec db psql -U postgres -d evaluation -c "SELECT id, message FROM instructions;"
```
 id |                                  message
----+---------------------------------------------------------------------------
  1 | Réalise le docker-compose et branche le front sur le back. Bonne chance !
  2 | Test de persistance
  3 | Test de persistance
  (3 rows)
```
#### Suppression du conteneur (docker compose down)
#### Recréation du conteneur (docker compose up -d)
### On verifie si les lignes existes tourjours  (docker compose exec db psql -U postgres -d evaluation -c "SELECT id, message FROM instructions;")
```
 id |                                  message
----+---------------------------------------------------------------------------
  1 | Réalise le docker-compose et branche le front sur le back. Bonne chance !
  2 | Test de persistance
  3 | Test de persistance
(3 rows)
```

#### On verifie que les HealthCheck sont fonctionnels (docker compose ps) 
```
NAME                              IMAGE                           COMMAND                  SERVICE    CREATED         STATUS                   PORTS
mon-projet-docker-tp-backend-1    mon-projet-docker-tp-backend    "docker-entrypoint.s…"   backend    5 minutes ago   Up 5 minutes (healthy)   0.0.0.0:3001->3001/tcp, [::]:3001->3001/tcp
mon-projet-docker-tp-db-1         postgres:18-alpine              "docker-entrypoint.s…"   db         5 minutes ago   Up 5 minutes (healthy)   5432/tcp
mon-projet-docker-tp-frontend-1   mon-projet-docker-tp-frontend   "docker-entrypoint.s…"   frontend   5 minutes ago   Up 5 minutes (healthy)   0.0.0.0:5173->5173/tcp, [::]:5173->5173/tcp
```

#### Ou en details : (docker inspect --format '{{json .State.Health}}' $(docker compose ps -q backend))
```
{"Status":"healthy","FailingStreak":0,"Log":[
{"Start":"2026-10-26T18:48:20.153818436Z","End":"2026-10-26T18:48:20.206295719Z","ExitCode":0,"Output":""},
{"Start":"2026-10-26T18:48:30.20700916Z","End":"2026-10-26T18:48:30.248272993Z","ExitCode":0,"Output":""},
{"Start":"2026-10-26T18:48:40.24911491Z","End":"2026-10-26T18:48:40.28589643Z","ExitCode":0,"Output":""},
{"Start":"2026-10-26T18:48:50.277912715Z","End":"2026-10-26T18:48:50.310729043Z","ExitCode":0,"Output":""},
{"Start":"2026-10-26T18:49:00.311864504Z","End":"2026-10-26T18:49:00.350484729Z","ExitCode":0,"Output":""}
]}
```

#### Après l'ajout du build multi stage, on vérifie que les nouveaux conteneurs "prod" occupe moins d'espace (docker images --format "table {{.Repository}}`t{{.Tag}}`t{{.Size}}")

```
frontend                        prod        90.4MB
backend                         prod        257MB
mon-projet-docker-tp-frontend   latest      337MB
mon-projet-docker-tp-backend    latest      257MB
```