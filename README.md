# Le Bouchon — Lourmarin

Site vitrine pour **Le Bouchon**, restaurant de tapas & saveurs du monde
au cœur de Lourmarin (Luberon).

> *« Ici, chaque plat raconte une histoire. »* — Martin, Jeremy & Thomas

## Aperçu

Site statique — HTML, CSS et un filet de JavaScript. Aucune dépendance,
aucun build step. Ambiance intimiste et conviviale, typographie mixte
serif / script pour reprendre l'esprit de la carte écrite à la main.

- **Hero** immersif avec photos du lieu
- **Notre histoire** — le mot des chefs
- **La carte** — l'intégralité du menu
- **Galerie** — ambiance et plats
- **Réservation** — lien direct vers le téléphone (`tel:`)
- Responsive, accessible (WCAG AA), respecte `prefers-reduced-motion`

## Structure

```
.
├── index.html
├── css/style.css
├── js/main.js
└── assets/favicon.svg
```

## Développement local

Ouvrir `index.html` dans un navigateur, ou servir avec n'importe quel
serveur statique :

```bash
python3 -m http.server 8000
# puis http://localhost:8000
```

## Déploiement

Le site est déployé sur un VPS via SSH. Les fichiers sont simplement copiés
dans le répertoire servi par nginx (ou équivalent). Les photos sont pour
l'instant des placeholders depuis Unsplash — à remplacer par les vraies
photos du restaurant.

## Contact

**Le Bouchon**
9, rue du Grand Pré — 84160 Lourmarin
☎︎ 04 90 09 18 16 — [@bouchonlourmarin](https://www.instagram.com/bouchonlourmarin/)
