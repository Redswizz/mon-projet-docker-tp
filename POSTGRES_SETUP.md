# Configuration PostgreSQL avec Docker

## Lancer un conteneur PostgreSQL temporaire

Pour tester l'application en local sans installer PostgreSQL, utilisez cette commande :

```bash
docker run -d --rm \
  --name postgres-eval \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=evaluation \
  -p 5432:5432 \
  -v $(pwd)/db/init.sql:/docker-entrypoint-initdb.d/init.sql \
  postgres:18-alpine
```

### Explications

| Option | Description |
|--------|-------------|
| `-d` | Exécute le conteneur en arrière-plan (detached) |
| `--name postgres-eval` | Nom du conteneur |
| `-e POSTGRES_PASSWORD=password` | Mot de passe PostgreSQL |
| `-e POSTGRES_DB=evaluation` | Base de données créée au démarrage |
| `-p 5432:5432` | Mappe le port 5432 du conteneur sur le port 5432 de l'ordinateur |
| `-v $(pwd)/db/init.sql:/docker-entrypoint-initdb.d/init.sql` | Monte le script SQL pour initialiser la DB |
| `postgres:18-alpine` | Image PostgreSQL 18 (version légère) |

## Configuration du backend

Une fois le conteneur lancé, configurez le backend avec le fichier `.env` :

```bash
cd backend
cp .env.example .env
```

Éditez `backend/.env` :

```
DATABASE_URL=postgresql://postgres:password@localhost:5432/evaluation
PORT=3001
```

## Vérification

Vérifiez que PostgreSQL est en cours d'exécution :

```bash
docker ps | grep postgres-eval
```

Vérifiez que la table a été créée :

```bash
docker exec postgres-eval psql -U postgres -d evaluation -c "SELECT * FROM instructions;"
```

## Arrêter et nettoyer

Pour arrêter le conteneur :

```bash
docker stop postgres-eval
```

Avec `--rm`, le conteneur est supprimé automatiquement à l'arrêt (sinon : `docker rm postgres-eval`).

## Workflow complet

```bash
# 1. Lancer PostgreSQL
docker run -d \
  --name postgres-eval \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=evaluation \
  -p 5432:5432 \
  -v $(pwd)/db/init.sql:/docker-entrypoint-initdb.d/init.sql \
  postgres:18-alpine

# 2. Configurer le backend
cd backend
cp .env.example .env
npm install
npm run dev

# 3. Dans un autre terminal, lancer le frontend
cd frontend
npm install
npm run dev

# 4. Ouvrir http://localhost:5173 dans le navigateur
```
