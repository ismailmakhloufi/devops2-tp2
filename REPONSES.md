
# TP2 — Orchestrer une application multi-conteneurs avec Docker Compose

**Module : DevOps 2 — ECUE733**

## Partie 1 — Découvrir les deux applications

### Q1. Quelles variables d'environnement Strapi attend-il pour se connecter à PostgreSQL ? Pourquoi DATABASE_HOST=postgres et non localhost ?

Strapi utilise les variables suivantes :

- `DATABASE_CLIENT` : type de base de données (`postgres`).
- `DATABASE_HOST` : nom du serveur (`postgres`).
- `DATABASE_PORT` : port PostgreSQL (`5432`).
- `DATABASE_NAME` : nom de la base (`strapi`).
- `DATABASE_USERNAME` : utilisateur (`strapi`).
- `DATABASE_PASSWORD` : mot de passe de connexion.

Le fichier prévoit également des variables facultatives comme `DATABASE_URL`, `DATABASE_SSL` et `DATABASE_SCHEMA`.

On utilise `DATABASE_HOST=postgres` car Docker Compose permet aux conteneurs de communiquer grâce aux noms des services.

On n'utilise pas `localhost`, car dans un conteneur Docker, `localhost` désigne le conteneur lui-même.

### Q2. À quoi sert backend/.env.example ? Pourquoi le vrai fichier .env ne doit-il jamais être commité ?

Le fichier `.env.example` sert de modèle de configuration. Il indique les variables d'environnement nécessaires pour exécuter l'application.

Le fichier `.env` contient les valeurs réellement utilisées, notamment les mots de passe et les clés secrètes.

Il ne doit jamais être commité sur GitHub, car cela pourrait exposer des informations sensibles.

Le fichier `.gitignore` doit donc contenir `.env`.

---

## Partie 2 — PostgreSQL

### Q3. Quelle différence entre docker compose down et docker compose down -v ?

La commande `docker compose down` arrête et supprime les conteneurs et les réseaux créés par Compose, mais conserve les volumes nommés.

La commande `docker compose down -v` supprime également les volumes nommés et leurs données.

Lors de notre expérience :

- Après `docker compose down`, le volume `tp2_pgdata` existait toujours.
- Après `docker compose down -v`, le volume `tp2_pgdata` avait disparu.

Cela montre que les volumes permettent de conserver les données PostgreSQL indépendamment des conteneurs.

### Q4. Pourquoi écrit-on $${POSTGRES_USER} avec deux signes $ dans le healthcheck ?

On utilise `$$` pour empêcher Docker Compose de remplacer la variable avant le démarrage du conteneur.

Ainsi, `${POSTGRES_USER}` est transmis au shell du conteneur PostgreSQL, qui utilise sa propre variable d'environnement.

Cela permet au healthcheck `pg_isready` de vérifier correctement la disponibilité de PostgreSQL.

---

## Partie 3 — pgAdmin

### Q5. Pourquoi "Host": "postgres" ? Que signifie :ro ? Que signifie ${PGADMIN_PORT:-5050} ?

**Host: postgres**

Le nom `postgres` correspond au service PostgreSQL dans Docker Compose. Il permet à pgAdmin de trouver le serveur grâce au réseau Docker.

**:ro**

`ro` signifie *read-only* (lecture seule).

Dans le montage `./pgadmin/servers.json:/pgadmin4/servers.json:ro`, pgAdmin peut lire le fichier, mais ne peut pas le modifier depuis le conteneur.

**${PGADMIN_PORT:-5050}**

Cette expression utilise la valeur de `PGADMIN_PORT` si elle est définie et non vide.

Sinon, Docker Compose utilise la valeur par défaut `5050`.

---

## Partie 4 — Strapi

### Q6. Pourquoi copier package.json et package-lock.json avant le reste du code ? Quelles étapes sont rejouées après une modification ?

On copie d'abord `package.json` et `package-lock.json` pour profiter du système de cache Docker.

L'instruction `RUN npm ci` installe les dépendances.

Si ces fichiers ne changent pas, Docker réutilise la couche contenant les dépendances déjà installées.

Lorsqu'on modifie un fichier dans `backend/config/`, les premières étapes restent en cache :

- `COPY package.json package-lock.json ./`
- `RUN npm ci`

Les étapes suivantes sont réexécutées :

- `COPY . .`
- `RUN npm run build`
- Copie des fichiers vers l'image finale.

Cela accélère les reconstructions Docker.

### Q7. À quoi servent USER node et --chown=node:node ?

`USER node` permet d'exécuter l'application avec un utilisateur non administrateur plutôt qu'avec `root`.

Cela améliore la sécurité du conteneur.

`--chown=node:node` attribue les fichiers copiés à l'utilisateur `node` et au groupe `node`.

Ainsi, l'application peut accéder à ses fichiers avec les permissions appropriées.

### Q8. Que fait depends_on: condition: service_healthy ? Que se passerait-il sans ?

`depends_on: condition: service_healthy` oblige Docker Compose à attendre que PostgreSQL soit opérationnel avant de démarrer Strapi.

Sans cette condition, Strapi pourrait démarrer avant que PostgreSQL soit prêt.

Cela pourrait provoquer des erreurs de connexion à la base de données.

Le healthcheck permet donc de mieux coordonner le démarrage des services.

### Q9. Retrouvez la table articles dans pgAdmin. Combien de lignes pour un article publié ?

La table `articles` se trouve dans :

`Databases → strapi → Schemas → public → Tables → articles`

Strapi 5 utilise un système de gestion des brouillons et des versions publiées (*Draft & Publish*).

Un article publié peut être représenté par deux lignes dans la table `articles` : une pour la version brouillon et une pour la version publiée.

Ces versions sont liées par le même `document_id` et distinguées notamment par `published_at`.

**Résultat à confirmer dans pgAdmin :** nombre de lignes réellement observées pour un article publié.

---

## Partie 5 — Next.js

### Q10. Pourquoi STRAPI_URL=http://localhost:1337 ne fonctionnerait-il pas dans le conteneur ?

Dans Docker, chaque conteneur possède son propre environnement réseau.

Si Next.js utilise `http://localhost:1337`, il cherche le serveur Strapi dans son propre conteneur.

Or, Strapi fonctionne dans un autre conteneur.

Il faut donc utiliser :

`STRAPI_URL=http://strapi:1337`

Le nom `strapi` est résolu automatiquement sur le réseau partagé Docker Compose.

### Q11. Combien d'étapes FROM possède le Dockerfile ? Que contient l'image finale ? Que se passe-t-il sans standalone ?

Le Dockerfile frontend contient trois étapes :

1. `deps` : installation des dépendances avec `npm ci`.
2. `builder` : compilation de l'application Next.js.
3. `runner` : exécution de l'application.

L'image finale contient le serveur Next.js standalone, les fichiers statiques, le dossier public et les dépendances nécessaires à l'exécution.

Elle ne contient pas l'ensemble des outils et dépendances de construction.

Sans `output: "standalone"` dans `next.config.ts`, le dossier `.next/standalone` n'est pas généré.

Le build Docker échoue donc lors de l'instruction qui tente de copier ce dossier dans l'image finale.

Après exécution de la commande docker images tp2/frontend, nous avons obtenu :

Image : tp2/frontend:latest

Disk Usage : 334 MB

Content Size : 85,6 MB
---

## Partie 6 — Réseaux et sécurité

### Q12. Pourquoi Strapi est-il dans les deux réseaux ? Quel est l'intérêt de ne publier aucun port pour PostgreSQL ?

Strapi appartient aux deux réseaux :

- `frontend` : communication entre Next.js et Strapi.
- `backend` : communication entre Strapi, PostgreSQL et pgAdmin.

Strapi joue donc le rôle d'intermédiaire entre le frontend et la base de données.

PostgreSQL n'expose aucun port sur la machine hôte pour limiter les accès externes et réduire les risques de sécurité.

**Résultats de notre expérience :**

Depuis le frontend, la commande :

`nc -zv -w2 postgres 5432`

retourne :

`nc: bad address 'postgres'`

Cela signifie que le frontend ne peut pas résoudre le nom du service PostgreSQL.

En revanche, la commande :

`wget -qO- http://strapi:1337/_health && echo OK`

retourne :

`OK`

Cela confirme que Next.js peut communiquer avec Strapi.

L'isolation des réseaux fonctionne correctement.

### Q13. Citez deux autres mesures pour sécuriser cette stack en production.

**1. Protéger les secrets**

Utiliser un gestionnaire de secrets pour stocker les mots de passe, les clés JWT et les autres informations sensibles.

Éviter de placer des secrets directement dans le code source ou dans les images Docker.

**2. Sécuriser les communications et les accès**

Activer HTTPS avec un reverse proxy et limiter l'accès aux interfaces d'administration de Strapi et de pgAdmin.

Cela permet de réduire les risques d'accès non autorisé.

---

## Partie 7 — Cycle de vie

### Q14. Que fait restart: unless-stopped ? Pourquoi Strapi ne redémarre-t-il pas automatiquement après docker compose stop strapi ? Dans quel cas Docker le redémarre-t-il automatiquement ?

La politique `restart: unless-stopped` permet à Docker de redémarrer automatiquement un conteneur lorsqu'il s'arrête de manière inattendue.

Cependant, lorsque nous exécutons :

`docker compose stop strapi`

l'arrêt est volontaire. Docker respecte cette décision et ne redémarre pas automatiquement le conteneur.

De même, après un `docker compose kill strapi`, la politique de redémarrage ne provoque pas nécessairement un redémarrage immédiat, car il s'agit d'un arrêt explicitement demandé via Docker.

Docker redémarre automatiquement le conteneur en cas d'arrêt inattendu du processus principal, par exemple lors d'un crash de Strapi, si le conteneur n'a pas été arrêté volontairement.

Lors de notre expérience, après l'arrêt de Strapi, le site Next.js affichait une erreur, car il ne pouvait plus récupérer les articles depuis l'API.

Après le redémarrage de Strapi, la communication peut être rétablie.
