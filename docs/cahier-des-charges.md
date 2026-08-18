# Cahier des charges — AppLaser

## 1. Contexte et objectif

Application web personnelle destinée à piloter et préparer des travaux pour une graveuse laser **Elegoo Phecda** (10W/20W), dans un cadre d'usage hobby/atelier personnel.

Objectif : permettre d'importer un design (image, SVG, DXF), de le préparer (positionnement, réglages puissance/vitesse), de générer le G-code correspondant, et de gérer une bibliothèque de projets et de presets matériaux — sans dépendre exclusivement de LightBurn/LaserGRBL.

## 2. Matériel cible

| Caractéristique | Valeur |
|---|---|
| Machine | Elegoo Phecda |
| Puissance | 10W ou 20W (selon version) |
| Zone de gravure | 400 x 400 mm |
| Firmware | GRBL |
| Vitesse max | 25 000 mm/min |
| Spot focal | 0,07 x 0,13 mm (10W : 0,06 x 0,06 mm) |
| Connectivité | USB (série), Wi-Fi, carte TF/microSD, app mobile |
| Logiciels compatibles connus | LightBurn, LaserGRBL |

Conséquence technique : l'application doit pouvoir dialoguer en GRBL (commandes G-code standard + $-commands) via port série (USB) et, si possible, via Wi-Fi.

## 3. Utilisateurs et contexte d'usage

- Usage personnel, mono-utilisateur (pas de gestion de comptes/rôles dans un premier temps).
- Utilisation depuis un poste de travail (PC/Mac) connecté à la machine, dans un même réseau local ou via câble USB.
- Pas de contrainte de production industrielle ; priorité à la simplicité d'usage et à la fiabilité du pilotage.

## 4. Périmètre fonctionnel

### 4.1 MVP (version 1)

**Import et préparation de design**
- Import d'images matricielles (PNG, JPG) pour gravure trame (raster).
- Import de fichiers vectoriels SVG pour découpe/gravure vectorielle.
- Import de fichiers DXF.
- Positionnement, redimensionnement et rotation du design sur un aperçu de la zone de travail (400x400mm).
- Réglages par calque/objet : puissance (%), vitesse (mm/min), nombre de passes, mode (gravure trame / découpe vectorielle / marquage ligne).

**Génération de G-code**
- Génération de G-code compatible GRBL à partir du design préparé.
- Aperçu du G-code généré et estimation du temps d'exécution.
- Export du G-code (fichier .gcode/.nc) pour utilisation via carte SD si besoin.

**Bibliothèque de projets et presets**
- Sauvegarde/chargement de projets (design + réglages).
- Bibliothèque de presets matériaux (ex : contreplaqué 3mm, MDF, acrylique, cuir) avec puissance/vitesse recommandées, éditable par l'utilisateur.

**Pilotage machine (contrôle direct)**
- Connexion série USB à la machine (GRBL).
- Envoi du G-code généré directement à la machine, avec suivi de progression.
- Contrôles de base : jog (déplacement XY), homing, définition de l'origine de travail, cadrage laser (préverrouillage de la zone à faible puissance), pause/reprise/arrêt d'urgence.
- Affichage des retours GRBL (statut, alarmes, erreurs).

### 4.2 Hors périmètre MVP (évolutions possibles)

- Connexion Wi-Fi directe à la machine (v1 : USB uniquement).
- Multi-utilisateurs / comptes / partage de projets.
- Génération automatique de trajectoires d'optimisation avancées (nesting, tri-tramage complexe).
- Support d'autres machines/firmwares que GRBL.
- Application mobile native (le web restera responsive mais pas d'app dédiée).

## 5. Exigences non fonctionnelles

- **Sécurité d'usage** : confirmation obligatoire avant tout lancement de gravure/découpe ; bouton d'arrêt d'urgence toujours accessible à l'écran pendant un job ; rappel visuel des risques laser (classe 4).
- **Fiabilité** : la perte de connexion série pendant un job doit être détectée et signalée clairement, sans corruption du projet.
- **Performance** : génération de G-code pour un design raster 400x400mm en moins de quelques secondes sur un poste standard.
- **Portabilité** : application web utilisable sur les navigateurs modernes (Chrome/Edge/Firefox) sous Windows/Mac/Linux. L'accès au port série nécessite un navigateur compatible Web Serial API (Chrome/Edge).
- **Données locales** : les projets et presets doivent être conservés localement (pas d'obligation de compte cloud dans le MVP).

## 6. Architecture technique envisagée (à valider)

- **Frontend** : application web (SPA), rendu du plan de travail et des designs sur `<canvas>`.
- **Communication machine** : Web Serial API (navigateur → USB → GRBL), ce qui impose Chrome/Edge desktop pour les fonctions de pilotage direct.
- **Génération de G-code** : logique de conversion image/vecteur → G-code exécutée côté client ou via un petit backend local.
- **Stockage** : stockage local (navigateur / fichiers locaux) pour projets et presets, sans backend obligatoire dans un premier temps.

*Ce choix d'architecture reste à confirmer avec l'utilisateur avant le début du développement.*

## 7. Contraintes

- Le pilotage machine en direct depuis le navigateur dépend du support de la Web Serial API → limite l'usage à des navigateurs Chromium sur desktop pour cette fonctionnalité (l'import/génération de G-code restent utilisables partout).
- Zone de travail fixe à 400x400mm à respecter dans l'aperçu et les contrôles de bornes.
- Laser de classe 4 : l'application ne doit jamais lancer un job sans confirmation explicite de l'utilisateur.

## 8. Critères d'acceptation (MVP)

1. L'utilisateur peut importer une image ou un SVG et le positionner sur un aperçu fidèle de la zone 400x400mm.
2. L'utilisateur peut définir puissance/vitesse/passes et générer un G-code valide, exécutable sur la Phecda.
3. L'utilisateur peut sauvegarder un projet et le retrouver plus tard avec tous ses réglages.
4. L'utilisateur peut choisir un preset matériau et l'appliquer à son design.
5. L'utilisateur peut se connecter en USB à la machine, envoyer le G-code, suivre la progression, et arrêter le job à tout moment.

## 9. Points ouverts à trancher avec l'utilisateur

- Backend local nécessaire ou tout doit rester 100% côté navigateur ?
- Faut-il prévoir dès le MVP un mode "caméra" (aperçu photo de la pièce sous le laser) ? *(fonctionnalité native Phecda avec sa propre caméra/app)*
- Quel niveau de bibliothèque de presets par défaut fournir (liste de matériaux de départ) ?
- Priorité entre USB et Wi-Fi pour le pilotage direct si les deux doivent être supportés à terme.
