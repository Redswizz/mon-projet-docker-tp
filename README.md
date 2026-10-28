# Projet d'évaluation Docker

Stack web multi-conteneurs conteneurisée avec Docker et Docker Compose :

- **Frontend** : application React 19 (Vite 8) qui affiche une instruction récupérée depuis le backend
- **Backend** : API Node.js / Express 5 qui lit l'instruction dans PostgreSQL
- **Base de données** : PostgreSQL 18 (image publique `postgres:18-alpine`), initialisée par `db/init.sql`

Deux modes de fonctionnement :

| Mode | Commande | Point d'entrée |
|------|----------|----------------|
| **Développement** | `docker compose up --build -d` | http://localhost:5173 |
| **Production locale** | `docker compose -f compose.yaml -f compose.prod.yaml up --build -d` | http://localhost |

## Sommaire

1. [Prérequis](#prérequis)
2. [Structure du projet](#structure-du-projet)
3. [Architecture](#architecture)
4. [Installation et lancement](#installation-et-lancement)
5. [Vérifier que tout fonctionne](#vérifier-que-tout-fonctionne)
6. [Vérifier la persistance des données](#vérifier-la-persistance-des-données)
7. [Configuration, variables et secrets](#configuration-variables-et-secrets)
8. [Dockerfiles](#dockerfiles)
9. [Build multi-architecture](#build-multi-architecture-amd64--arm64)
10. [Registry et stratégie de versioning](#registry-et-stratégie-de-versioning)
11. [Scan de sécurité (optionnel)](#scan-de-sécurité-optionnel)
12. [Troubleshooting](#troubleshooting)
13. [API et base de données](#api-et-base-de-données)
14. [Preuves](#preuves)

## Prérequis

- **Docker** : [Docker Desktop](https://docs.docker.com/get-started/get-docker/) (Windows / macOS) ou Docker Engine (Linux)
- **Docker Compose v2.24.4 ou plus** (les tags `!reset` et `!override` de `compose.prod.yaml` l'exigent). Inclus dans Docker Desktop. Vérification : `docker compose version`
- **Docker Buildx** (uniquement pour le build multi-architecture), inclus dans Docker Desktop
- **Git**, pour cloner le dépôt

Node.js n'est **pas** nécessaire : tout tourne dans les conteneurs.

## Structure du projet

```
mon-projet-docker-tp/
├── backend/
│   ├── Dockerfile            # targets : development, production
│   ├── .dockerignore
│   ├── package.json
│   └── src/index.js
├── frontend/
│   ├── Dockerfile            # targets : development, production (Nginx)
│   ├── .dockerignore
│   ├── nginx.conf            # reverse proxy /api -> backend (prod)
│   ├── package.json
│   ├── vite.config.js
│   └── src/
├── db/
│   └── init.sql              # script d'initialisation PostgreSQL
├── secrets/
│   └── db_password.txt.example   # exemple (le vrai fichier n'est pas commité)
├── compose.yaml              # stack de base (mode développement)
├── compose.prod.yaml         # surcharge : mode production locale
├── .env.example
├── .gitignore
└── README.md
```

## Architecture

```
                         front_net                  back_net (internal)
navigateur ──► frontend ─────────────► backend ─────────────────────► db
              (Vite en dev,                                       (PostgreSQL 18,
               Nginx en prod)                                      volume db_data)
```

| Réseau | Services | Rôle |
|--------|----------|------|
| `front_net` | frontend, backend | réseau exposé |
| `back_net` (`internal: true`) | backend, db | réseau interne : la base n'est joignable que par le backend et n'a pas accès à Internet |

- La base de données n'est **que** sur `back_net`.
- En **prod**, le seul point d'entrée est Nginx (port 80). Il sert le front et relaie `/api/` vers le backend, dont aucun port n'est publié.
- En **dev**, le port 3001 du backend est publié pour faciliter les tests directs.
- Ordre de démarrage garanti par des healthchecks : `db` (healthy) → `backend` (healthy) → `frontend`.

## Installation et lancement

### 1. Cloner le dépôt

```bash
git clone <https://github.com/Redswizz/mon-projet-docker-tp.git>
cd <mon-projet-docker-tp>
```

### 2. Créer le secret de la base de données

Le mot de passe n'est **jamais** dans le code ni dans Git : il est lu depuis un fichier local ignoré par Git.

```bash
cp secrets/db_password.txt.example secrets/db_password.txt
```

Éditez ensuite `secrets/db_password.txt` et remplacez `changeme` par le mot de passe : __(evaluation)__ (une seule ligne, encodage ASCII / UTF-8 **sans BOM**).

Sous PowerShell, vous pouvez aussi le créer directement :

```powershell
Set-Content -Path secrets/db_password.txt -Value "evaluation" -NoNewline -Encoding ascii
```

### 3. (Optionnel) Créer le fichier `.env`

```bash
cp .env.example .env
```

Il ne contient que de la configuration non sensible (le port d'entrée en prod). Valeurs par défaut utilisées s'il est absent.

### 4a. Mode développement

```bash
docker compose up --build -d
docker compose ps
```

- Frontend (Vite) : http://localhost:5173
- API : http://localhost:3001/api/health

Le conteneur `frontend` lance le serveur Vite (`npm run dev`), qui relaie `/api` vers le backend (`API_PROXY_TARGET=http://backend:3001`). Les images sont construites avec la target `development`. Après une modification du code, relancez avec `--build`.

### 4b. Mode production locale

```bash
docker compose down
docker compose -f compose.yaml -f compose.prod.yaml up --build -d
docker compose -f compose.yaml -f compose.prod.yaml ps
```

- Application : http://localhost (port modifiable avec `HTTP_PORT` dans `.env`)

`compose.prod.yaml` surcharge `compose.yaml` : target `production` pour le front (Nginx) et le back, port 3001 du backend fermé, seul le port 80 est publié.

### 5. Arrêter

```bash
docker compose down        # arrête et supprime les conteneurs (les données sont conservées)
docker compose down -v     # supprime AUSSI le volume : la base repart de zéro
```

Faites toujours un `docker compose down` avant de passer d'un mode à l'autre.

### Lancement sans Docker (optionnel)

Le backend accepte aussi `DATABASE_URL` (voir [Configuration](#configuration-variables-et-secrets)). Il faut alors Node.js 24 (minimum 22.12) et un PostgreSQL local initialisé avec `db/init.sql` :

```bash
cd backend && cp .env.example .env && npm install && npm run dev
cd frontend && npm install && npm run dev
```

## Vérifier que tout fonctionne

> Sous PowerShell, utilisez `curl.exe` à la place de `curl` (`curl` y est un alias d'`Invoke-WebRequest`).

### Mode développement

```bash
docker compose ps                              # db, backend, frontend : (healthy)
curl http://localhost:3001/api/health          # {"status":"ok","database":"up"}
curl http://localhost:3001/api/instruction     # JSON avec le message de la table instructions
```

Ouvrez http://localhost:5173 : l'instruction s'affiche dans la page.

### Mode production locale

```bash
docker compose -f compose.yaml -f compose.prod.yaml ps
curl -i http://localhost/                      # 200, HTML du frontend (servi par Nginx)
curl http://localhost/api/health               # {"status":"ok","database":"up"} (via Nginx)
curl http://localhost/api/instruction          # JSON de l'instruction
curl http://localhost:3001/api/health          # doit ÉCHOUER : le backend n'est plus exposé
```

### Isolation réseau

```bash
docker compose exec backend ping -c 1 db            # répond : le backend voit la base
docker compose exec frontend ping -c 1 db           # "bad address 'db'" : le front ne voit pas la base
docker compose exec db ping -c 1 -W 2 8.8.8.8       # "Network unreachable" : la base n'a pas Internet
```

### Exécution en non-root

```bash
docker compose exec backend whoami      # node
docker compose exec frontend whoami     # un utilisateur autre que root
```

## Vérifier la persistance des données

La base utilise le volume nommé `db_data` (monté sur `/var/lib/postgresql`, chemin attendu par PostgreSQL 18).

```bash
# 1. Démarrer la stack
docker compose up -d

# 2. Ajouter une donnée de test
docker compose exec db psql -U postgres -d evaluation \
  -c "INSERT INTO instructions (message) VALUES ('Test de persistance');"

# 3. Supprimer les conteneurs (le volume est conservé)
docker compose down

# 4. Relancer et vérifier : la ligne doit toujours être là
docker compose up -d
docker compose exec db psql -U postgres -d evaluation \
  -c "SELECT id, message FROM instructions;"
```

Liste des volumes : `docker volume ls` (le volume s'appelle `<nom-du-dossier>_db_data`).

> `init.sql` n'est exécuté qu'à la **première** initialisation, quand le volume est vide.

## Configuration, variables et secrets

### Secret : mot de passe de la base

| Élément | Détail |
|---------|--------|
| Fichier local | `secrets/db_password.txt` (**ignoré par Git**) |
| Fichier d'exemple | `secrets/db_password.txt.example` (commité) |
| Déclaration | bloc `secrets:` de `compose.yaml` |
| Dans les conteneurs | monté en lecture seule dans `/run/secrets/db_password` |
| Côté PostgreSQL | `POSTGRES_PASSWORD_FILE=/run/secrets/db_password` |
| Côté backend | `DB_PASSWORD_FILE=/run/secrets/db_password` (lu par `src/index.js`) |

Le mot de passe n'apparaît donc ni dans le code, ni dans les images, ni dans les variables d'environnement, ni dans Git.

> Changer le contenu du fichier après une première initialisation ne change pas le mot de passe déjà enregistré dans le volume : faites `docker compose down -v` pour réinitialiser la base.

### Variables du backend

| Variable | Description | Valeur dans Compose |
|----------|-------------|---------------------|
| `DB_PASSWORD_FILE` | chemin du fichier contenant le mot de passe (active le mode « secret ») | `/run/secrets/db_password` |
| `DB_HOST` | hôte PostgreSQL | `db` |
| `DB_PORT` | port PostgreSQL | `5432` (défaut) |
| `DB_NAME` | nom de la base | `evaluation` |
| `DB_USER` | utilisateur | `postgres` |
| `DATABASE_URL` | alternative : URL complète (utilisation hors Docker) | non utilisée |
| `PORT` | port du serveur Express | `3001` (défaut) |

### Variables du frontend

| Variable | Description | Exemple |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | URL du backend, injectée **au build**. Vide par défaut : appels sur la même origine (`/api/...`) | *(vide)* |
| `API_PROXY_TARGET` | cible du proxy `/api` du serveur Vite (dev) | `http://backend:3001` |

### Variables de Compose (`.env`)

| Variable | Description | Défaut |
|----------|-------------|--------|
| `HTTP_PORT` | port de la machine hôte pour l'entrée Nginx en mode prod | `80` |

`.env` est ignoré par Git ; seul `.env.example` est commité. Il ne contient aucun secret.

## Dockerfiles

Les deux Dockerfiles sont **multi-stage** avec deux targets.

| Service | Target `development` | Target `production` |
|---------|----------------------|---------------------|
| **backend** | `node:24-alpine`, toutes les dépendances, `npm run dev` | `node:24-alpine`, `npm ci --omit=dev`, copie de `src/` uniquement, `node src/index.js` |
| **frontend** | `node:24-alpine`, serveur Vite (`npm run dev`) | build Vite dans un stage intermédiaire, puis `nginx-unprivileged` qui sert uniquement le dossier `dist/` |

Choix et optimisations :

- **Cache des layers** : `package*.json` est copié et `npm ci` exécuté avant la copie du code ; les dépendances ne sont réinstallées que si elles changent.
- **Image de prod du frontend** : sans Node ni `node_modules` (environ 90 Mo contre 337 Mo pour l'image de dev, voir les preuves).
- **`.dockerignore`** dans chaque service (`node_modules`, `dist`, `.env`…) : contexte de build léger, aucun secret ni dépendance locale copiés dans les images.
- **Non-root** : `USER node` pour le backend et le frontend en dev ; l'image `nginxinc/nginx-unprivileged` tourne sans root en production (port **8080** dans le conteneur, publié sur le 80 de l'hôte).
- **Healthchecks** (dans Compose) : `pg_isready` pour la base, `wget` sur `/api/health` pour le backend (qui teste aussi la connexion à la base), `wget` sur la page d'accueil pour le frontend (port 5173 en dev, 8080 en prod).
- **Dépendances entre services** : `depends_on` avec `condition: service_healthy`.

## Build multi-architecture (amd64 + arm64)

Les images de base utilisées (`node:24-alpine`, `nginxinc/nginx-unprivileged`, `postgres:18-alpine`) existent pour `linux/amd64` et `linux/arm64`, et `pg` est du JavaScript pur : aucune compilation native n'est nécessaire.

```bash
# Créer un builder multi-plateforme (une seule fois)
docker buildx create --name multiarch --driver docker-container --use
docker buildx inspect --bootstrap          # doit lister linux/amd64 et linux/arm64

# Construire les deux architectures (sans publier)
docker buildx build --platform linux/amd64,linux/arm64 --target production ./backend
docker buildx build --platform linux/amd64,linux/arm64 --target production ./frontend
```

L'architecture non native est émulée, le build est donc plus long.

## Registry et stratégie de versioning

Registry choisi : **GitHub Container Registry (GHCR)**.

Images : `ghcr.io/<redswizz>/<repo>-backend` et `ghcr.io/<redswizz>/<repo>-frontend` (en minuscules).

| Tag | Signification |
|-----|---------------|
| `1.0.0` | version précise et immuable (semver, correspond au tag Git `v1.0.0`) |
| `latest` | dernière version stable |
| `sha-<commit>` | commit exact ayant produit l'image (traçabilité) |

### Publier les images (optionnel)

1. Créer un *Personal Access Token (classic)* GitHub avec le droit `write:packages`.
2. Se connecter :

```bash
docker login ghcr.io -u <utilisateur>
```

3. Construire et pousser les deux architectures (`--push` est obligatoire pour une image multi-arch) :

```bash
USER_GH=<utilisateur>
REPO=<repo>
SHA=$(git rev-parse --short HEAD)

docker buildx build --platform linux/amd64,linux/arm64 --target production \
  -t ghcr.io/$USER_GH/$REPO-backend:1.0.0 \
  -t ghcr.io/$USER_GH/$REPO-backend:latest \
  -t ghcr.io/$USER_GH/$REPO-backend:sha-$SHA \
  --push ./backend

docker buildx build --platform linux/amd64,linux/arm64 --target production \
  -t ghcr.io/$USER_GH/$REPO-frontend:1.0.0 \
  -t ghcr.io/$USER_GH/$REPO-frontend:latest \
  -t ghcr.io/$USER_GH/$REPO-frontend:sha-$SHA \
  --push ./frontend
```

Sous PowerShell : remplacer `\` par `` ` `` en fin de ligne, et les variables par `$USER_GH = "..."`.

4. Vérifier les deux architectures :

```bash
docker buildx imagetools inspect ghcr.io/$USER_GH/$REPO-backend:1.0.0
```

5. Pour que le paquet soit récupérable sans authentification : GitHub, onglet *Packages*, le paquet, *Package settings*, *Change visibility*, *Public*.

## Scan de sécurité (optionnel)

Procédure pour scanner une image de production avec [Trivy](https://trivy.dev/) :

```bash
docker build --target production -t frontend:prod ./frontend
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy:latest image --severity HIGH,CRITICAL frontend:prod
```

## Troubleshooting

**1. Le frontend (Nginx) redémarre en boucle : `unknown directive "﻿server"`**
Le fichier `frontend/nginx.conf` a été enregistré en UTF-8 **avec BOM** (Notepad, `Out-File` sous PowerShell 5). Enregistrez-le en « UTF-8 » simple, puis reconstruisez (`up --build`). Diagnostic : `docker compose logs frontend`.

**2. Le port 80 est déjà utilisé (ou `curl http://localhost/` échoue)**
Diagnostic : `docker compose -f compose.yaml -f compose.prod.yaml ps -a` (le frontend est-il démarré ?) puis `logs frontend`. Si le port est pris, définissez `HTTP_PORT=8080` dans `.env` et relancez ; l'application sera sur http://localhost:8080.

**3. Le backend reste `unhealthy` ou la base refuse la connexion (`password authentication failed`)**
Diagnostic : `docker compose logs backend db`. Cause fréquente : `secrets/db_password.txt` modifié **après** la première initialisation du volume. Solution : `docker compose down -v` puis relancer. Vérifiez aussi que le fichier est en ASCII / UTF-8 sans BOM (sous Windows PowerShell, évitez `echo "..." > fichier`, qui écrit en UTF-16).

**4. `docker compose` : erreur sur `!reset` / `!override` (tag inconnu)**
Votre version de Compose est trop ancienne. Vérifiez avec `docker compose version` (il faut v2.24.4 ou plus) et mettez à jour Docker Desktop.

**5. `secrets/db_password.txt: no such file or directory` au `up`**
Le secret n'a pas été créé après le clonage (il n'est pas dans Git). Exécutez `cp secrets/db_password.txt.example secrets/db_password.txt` et modifiez le mot de passe.

**6. Après un changement de code, rien ne change**
Les images embarquent le code : relancez avec `docker compose up --build -d`.

Commandes de diagnostic utiles : `docker compose ps -a`, `docker compose logs <service>`, `docker compose config` (configuration fusionnée), `docker inspect --format '{{json .State.Health}}' <conteneur>`.

## API et base de données

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

### Schéma de la base de données

Table `instructions` :

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | SERIAL | Clé primaire auto-incrémentée |
| `message` | TEXT | Message de l'instruction |
| `created_at` | TIMESTAMPTZ | Date de création |

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

#### Après l'ajout des secrets, on supprime les anciens conteneurs et en construit de nouveaux, car la base est déjà initialisée avec les mot de passe "password"
#### ( docker compose down -v | docker compose up --build -d | docker compose ps)
```
mon-projet-docker-tp-backend-1    mon-projet-docker-tp-backend    "docker-entrypoint.s…"   backend    21 seconds ago   Up 14 seconds (healthy)   0.0.0.0:3001->3001/tcp, [::]:3001->3001/tcp
mon-projet-docker-tp-db-1         postgres:18-alpine              "docker-entrypoint.s…"   db         21 seconds ago   Up 20 seconds (healthy)   5432/tcp
mon-projet-docker-tp-frontend-1   mon-projet-docker-tp-frontend   "docker-entrypoint.s…"   frontend   21 seconds ago   Up 8 seconds (healthy)    0.0.0.0:5173->5173/tcp, [::]:5173->5173/tcp
```

#### On verifie que le mot de passe est monté dans le conteneur (docker compose exec backend cat /run/secrets/db_password)
```
***** (Le mot de passe est bon, il faut me croire sur parole)
```

#### On verifie que le mot de passe n'est plus dans la variable d'environnement (docker compose exec db env | Select-String "PASSWORD")
```
POSTGRES_PASSWORD_FILE=/run/secrets/db_password
```

#### Ni dans les sources (Select-String -Path compose.yaml,backend/src/index.js -Pattern "password")

```
compose.yaml:6:      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
compose.yaml:8:      - db_password
compose.yaml:28:      DB_PASSWORD_FILE: /run/secrets/db_password
compose.yaml:30:      - db_password
compose.yaml:67:  db_password:
compose.yaml:68:    file: ./secrets/db_password.txt
backend\src\index.js:8:// Mode 1 : DB_PASSWORD_FILE (secret Docker). Mode 2 : DATABASE_URL (dev hors Docker).
backend\src\index.js:10:  if (process.env.DB_PASSWORD_FILE) {
backend\src\index.js:16:      password: fs.readFileSync(process.env.DB_PASSWORD_FILE, 'utf8').trim(),
backend\src\index.js:22:  console.error('ERROR: define DB_PASSWORD_FILE (+ DB_HOST, DB_NAME, DB_USER) or DATABASE_URL');
```


#### Après l'ajout de la config compose.prod.yaml, on build les conteneurs avec la target prod( docker compose -f compose.yaml -f compose.prod.yaml up --build -d )
#### Et on verifie qu'ils sont Healthy (docker compose -f compose.yaml -f compose.prod.yaml ps)
```
 ✔ Image mon-projet-docker-tp-backend        Built                                                                                                                                                           3.3s
 ✔ Image mon-projet-docker-tp-frontend       Built                                                                                                                                                           3.3s
 ✔ Container mon-projet-docker-tp-db-1       Healthy                                                                                                                                                         0.7s
 ✔ Container mon-projet-docker-tp-backend-1  Healthy                                                                                                                                                         1.3s
 ✔ Container mon-projet-docker-tp-frontend-1 Started 
```

#### Pour handle le multi architecture, on utilise Buildx, déjà inclus avec docker desktop (docker buildx create --name multiarch --driver docker-container --use | docker buildx inspect --bootstrap)
#### Les commandes pour le build multi-architecture ( docker buildx build --platform linux/amd64,linux/arm64 --target production ./backend | docker buildx build --platform linux/amd64,linux/arm64 --target production ./frontend )