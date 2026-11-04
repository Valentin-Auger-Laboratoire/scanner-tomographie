# Simulateur de scanner : du sinogramme à l'image

🇫🇷 [Français](#français) · 🇬🇧 [English](#english)

**Essayer l'outil :** https://valentin-auger-laboratoire.github.io/portfolio/outils/scanner/

> Outil pédagogique : géométrie simplifiée (rayons parallèles, faisceau monoénergétique). **Pas un logiciel d'imagerie médicale.**

---

## Français

### Ce que fait l'outil
Un scanner (tomodensitométrie) tourne autour du patient et mesure, pour chaque angle, l'atténuation des rayons X à travers le corps. On obtient un **sinogramme**, puis on **calcule** l'image de la coupe. Ce simulateur, en JavaScript pur et sans bibliothèque, fait les deux étapes.

**Patients virtuels**, faits d'ellipses :
- tête de référence de Shepp-Logan ;
- crâne avec un hématome (70 HU, à peine plus dense que le cerveau) ;
- thorax : poumons, cœur, aorte, colonne, côtes ;
- thorax avec deux implants en acier.

**Acquisition**
- Nombre d'angles (10 à 720), cellules du détecteur, rotation de 60 à 180°.
- **Dose** : bruit de comptage des photons (loi de Poisson), « famine de photons » derrière le métal.

**Reconstruction**
- **Rétroprojection simple** : image floue, pour comprendre pourquoi il faut filtrer.
- **Rétroprojection filtrée**, la méthode des scanners cliniques, avec trois filtres :
  - rampe (Ram-Lak) ;
  - Shepp-Logan ;
  - Hann, plus doux, moins de bruit.
- **Itérative (SART)** : l'image est corrigée angle par angle pour coller aux mesures, avec μ ≥ 0. Elle est bien meilleure quand il y a peu d'angles.

**Affichage**
- Vérité, sinogramme, image reconstruite et carte d'écart.
- **Fenêtres en unités Hounsfield** : tissus mous, cerveau, poumon, os.
- Valeur au survol et profil horizontal.
- Écart moyen (RMSE) et PSNR par rapport à la vérité.

**Animation** : le tube et le détecteur tournent, le sinogramme se remplit ligne par ligne et l'image apparaît à mesure que les projections filtrées sont rétroprojetées.

**Cas à essayer** :
- examen standard ;
- 30 angles seulement ;
- faible dose ;
- sans filtre ;
- rotation de 120° (artefacts d'angle limité) ;
- hématome en fenêtre cerveau.

### Comment c'est calculé
- Loi de Beer-Lambert : N = N₀·e^(−∫μ dl). Le scanner mesure −ln(N/N₀), l'intégrale de μ le long du rayon.
- Projections des ellipses **exactes** (formule analytique), donc aucune erreur de discrétisation à l'acquisition.
- Rétroprojection filtrée :
  - noyau rampe discret de Ram-Lak (Kak et Slaney), fenêtré, appliqué par **transformée de Fourier rapide** (écrite à la main) avec remplissage de zéros ;
  - rétroprojection avec interpolation linéaire ;
  - normalisation π/nombre d'angles.
- SART (Andersen et Kak, 1984) :
  - projecteur par lancer de rayons avec interpolation bilinéaire ;
  - ordre des angles entrelacé, facteur de relaxation 0,25.
- HU = 1 000·(μ − μ_eau)/μ_eau, avec μ_eau = 0,19 cm⁻¹ (environ 70 keV).

### Fichiers
| Fichier | Rôle |
|---|---|
| `scanner.js` | Moteur : fantômes, projections exactes, acquisition bruitée, FFT, filtres, rétroprojections, SART, mesures de qualité (testable avec Node) |
| `index.html` | Interface et animation, bilingue FR / EN |
| `tests/test.js` | Tests |

### Lancer les tests
```bash
node tests/test.js
```
- Projections exactes des ellipses comparées à une intégration numérique le long du rayon.
- FFT comparée à la transformée discrète directe, aller-retour.
- Filtre rampe de réponse |ν|, fenêtre de Hann.
- **Disque uniforme reconstruit à sa valeur exacte** (μ = 0,200).
- Plus d'angles ou plus de dose donnent moins d'erreur. SART bat la rétroprojection filtrée avec 30 angles. Artefacts d'angle limité. Hann réduit le bruit à faible dose. La rétroprojection simple est floue.
- Bruit de Poisson non biaisé, d'écart-type ≈ 1/√N.
- Métal : rayons presque entièrement absorbés et artefacts jusque dans le cœur.

### Limites
- **Géométrie parallèle** : les vrais scanners utilisent un faisceau en éventail ou en cône, souvent en hélice.
- Faisceau **monoénergétique** : pas de durcissement de faisceau ni de diffusé, donc les artefacts métalliques réels sont plus forts.
- Patients faits d'ellipses, une seule coupe.
- SART est lent sur les grandes images (plusieurs secondes).

### Références
- Kak AC, Slaney M. *Principles of Computerized Tomographic Imaging.* IEEE Press, 1988.
- Shepp LA, Logan BF. *The Fourier reconstruction of a head section.* IEEE Trans Nucl Sci 21(3):21-43 (1974). Version modifiée de Toft (1996).
- Andersen AH, Kak AC. *Simultaneous algebraic reconstruction technique (SART).* Ultrasonic Imaging 6(1):81-94 (1984).

### Utiliser en local
Ouvrir `index.html` dans un navigateur.

---

## English

### What the tool does
A CT scanner simulator in plain JavaScript:
- virtual patients (Shepp-Logan head, skull with haematoma, chest, chest with steel implants);
- acquisition with adjustable angles, detector cells, rotation and dose (Poisson photon noise);
- reconstruction by simple backprojection, **filtered backprojection** (Ram-Lak, Shepp-Logan, Hann, via a hand-written FFT) or **iterative SART**;
- display in Hounsfield units with radiology windows, difference map, profile, RMSE and PSNR;
- an animation of the rotating gantry, the sinogram filling up and the image building up.

### Tests
```bash
node tests/test.js
```
- Exact ellipse projections versus numerical line integrals; FFT versus direct DFT.
- Uniform disc reconstructed at its exact value.
- Error decreasing with angles and dose; SART beating FBP with few angles; limited-angle artefacts.
- Unbiased Poisson noise; metal photon starvation.

### Limits
- Parallel-beam, monoenergetic, ellipse phantoms, single slice.
- Teaching tool, not medical imaging software.

---

← [Portfolio](https://valentin-auger-laboratoire.github.io/portfolio/#projets)
