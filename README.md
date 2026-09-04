# ORIENTIS

Site vitrine dune maison de haute horlogerie fictive — **ORIENTIS**.
Experience cinematique pilotee au geste, construite autour d une video produit.

## Voir le site

**Preview :** https://bouassidkimo-cmyk.github.io/orientis/

## En local

```bash
node serve.mjs      # puis http://localhost:8080
```
ou double-clic sur `start.bat` (Windows).
Les images de la sequence exigent un serveur HTTP (pas douverture directe du fichier).

## Stack

- HTML / CSS / JS natif, sans build
- Lenis (defilement fluide) + GSAP + ScrollTrigger via CDN
- Sequence cinematique : 172 images WebP pilotees au canvas, 3 gestes
- Videos de collection : boucles crossfade, lecture a lecran uniquement
- Typo : Fraunces + Archivo (Google Fonts)
- `prefers-reduced-motion` respecte

## Structure

```
index.html            page unique
css/style.css
js/app.js             moteur (sequence, collection, revele)
assets/frames/        172 images de la sequence
assets/collection/    3 boucles video + posters
assets/*.jpg          visuels editoriaux
```

---
ORIENTIS est une maison fictive. Tous les chiffres et references sont conceptuels.
