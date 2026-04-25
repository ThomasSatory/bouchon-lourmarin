# Le Bouchon — Lourmarin

Site vitrine pour **Le Bouchon**, restaurant de tapas & saveurs du monde
au cœur de Lourmarin (Luberon).

> *« Ici, chaque plat raconte une histoire. »* — Martin, Jeremy & Thomas

## Aperçu

Site vitrine + mini-backend Node/Express pour l'espace admin. Le contenu
dynamique (actualités, photos, carte, horaires) est stocké en JSON sur
disque, sans base de données.

- **Hero** immersif avec photos du lieu
- **Notre histoire** — le mot des chefs
- **La carte** — l'intégralité du menu
- **Actualités** — alimenté depuis le panel admin
- **Galerie** — ambiance et plats
- **Réservation** — lien direct vers le téléphone (`tel:`)
- **Panel admin** (`/admin`) — protégé par mot de passe, pour gérer
  actualités / photos / carte / horaires / contact
- Responsive, accessible (WCAG AA), respecte `prefers-reduced-motion`

## Structure

```
.
├── index.html           # Page publique
├── css/style.css
├── js/main.js
├── assets/
│   ├── photos/          # Photos d'origine (commit)
│   └── uploads/         # Photos uploadées via admin (volume)
├── admin/               # Panel admin (SPA HTML/CSS/JS)
│   ├── index.html
│   ├── admin.css
│   └── admin.js
├── server/              # Backend Express
│   ├── server.js
│   ├── package.json
│   └── data/            # content.json, sessions.json (volume)
└── Dockerfile
```

## Développement local

```bash
cd server && npm install
ADMIN_PASSWORD="mon-mdp" npm start
# http://localhost:3000          → site
# http://localhost:3000/admin    → panel admin
```

## Déploiement Docker

Le conteneur écoute sur `:3000`. Les données et les uploads doivent être
persistés dans des volumes — sinon ils disparaissent au redéploiement.

```bash
docker build -t bouchon-lourmarin .

docker run -d \
  --name bouchon \
  -p 80:3000 \
  -e ADMIN_PASSWORD="<mot-de-passe-admin>" \
  -v bouchon-data:/app/server/data \
  -v bouchon-uploads:/app/assets/uploads \
  --restart=unless-stopped \
  bouchon-lourmarin
```

### docker-compose (recommandé)

```yaml
services:
  bouchon:
    build: .
    restart: unless-stopped
    ports:
      - "80:3000"
    environment:
      ADMIN_PASSWORD: "<mot-de-passe-admin>"
    volumes:
      - bouchon-data:/app/server/data
      - bouchon-uploads:/app/assets/uploads

volumes:
  bouchon-data:
  bouchon-uploads:
```

### Variables d'environnement

| Variable         | Défaut              | Rôle                                          |
|------------------|---------------------|-----------------------------------------------|
| `ADMIN_PASSWORD` | `bouchon-lourmarin` | **À CHANGER** — mot de passe du panel admin   |
| `PORT`           | `3000`              | Port d'écoute                                  |

## Panel admin

1. Aller sur `https://<domaine>/admin`
2. Saisir le mot de passe
3. Onglets disponibles :
   - **Actualités** — créer / éditer / supprimer des news, avec image
   - **Photos** — remplacer n'importe quelle photo du site (auto-optimisées)
   - **Carte** — adresse, coordonnées GPS, lien Google Maps
   - **Infos** — téléphone, Instagram, horaires d'ouverture

La session dure 14 jours (cookie httpOnly).

## Contact

**Le Bouchon**
9, rue du Grand Pré — 84160 Lourmarin
☎︎ 04 90 09 18 16 — [@bouchonlourmarin](https://www.instagram.com/bouchonlourmarin/)
