# AppLaser

Application locale de pilotage et de préparation de travaux pour graveuse laser (Elegoo Phecda). Voir le [cahier des charges](docs/cahier-des-charges.md) pour le détail fonctionnel et l'architecture.

## Structure du projet

```
frontend/   React + TypeScript + Vite — interface (éditeur SVG, config des layers, pilotage machine via Web Serial API)
backend/    Node.js + TypeScript + Express — proxy/cache Overpass (OSM), stockage des projets/presets, génération G-code
docs/       Documentation (cahier des charges)
```

## Démarrage

Prérequis : Node.js 20+, navigateur Chrome/Edge desktop (requis pour le pilotage machine via Web Serial API).

```bash
npm install       # installe les dépendances du frontend et du backend
npm run dev       # lance le frontend (http://localhost:5173) et le backend (http://localhost:4000) ensemble
```

Pour lancer un seul des deux services : `npm run dev:frontend` ou `npm run dev:backend`.

## État actuel

Squelette initial du projet : structure des deux workspaces, backend avec routes stub pour Overpass (proxy+cache), projets, presets (peuplier 3mm préconfiguré) et génération G-code (à implémenter). Le frontend est le template Vite par défaut, pas encore l'interface de l'application.
