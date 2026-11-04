// Tests du simulateur de scanner : node tests/test.js
const assert = require('assert');
const S = require('../scanner.js');
let n = 0;
const close = (a, b, tol, msg) => { n++; assert.ok(Math.abs(a - b) <= tol * (1 + Math.abs(b)), (msg || '') + ' : ' + a + ' ≠ ' + b); };
const ok = (c, msg) => { n++; assert.ok(c, msg); };

// 1. Unités Hounsfield
close(S.mu2hu(S.MU_WATER), 0, 1e-12, 'eau = 0 HU'); close(S.mu2hu(0), -1000, 1e-12, 'air = −1 000 HU');
close(S.hu2mu(S.mu2hu(0.3)), 0.3, 1e-12, 'aller-retour μ ↔ HU');

// 2. Projection exacte d'une ellipse : comparée à une intégration numérique le long du rayon
{
  const e = [1.5, -0.8, 4, 2.5, 30, 0.2];
  for (const [th, s] of [[0, 0], [0.7, 1.2], [1.9, -2.0], [2.8, 3.1], [0.3, 6]]) {
    let num = 0; const L = 20, steps = 200000, dt = (2 * L) / steps;
    for (let k = 0; k < steps; k++) { const t = -L + (k + 0.5) * dt; num += S.phantomAt({ ellipses: [e] }, s * Math.cos(th) - t * Math.sin(th), s * Math.sin(th) + t * Math.cos(th)) * dt; }
    close(S.ellipseProjection(e, th, s), num, 2e-4, 'projection exacte θ = ' + th + ', s = ' + s);
  }
  // corde d'un disque : 2·√(r² − s²)·μ
  close(S.ellipseProjection([0, 0, 5, 5, 0, 0.19], 1.234, 3), 2 * 4 * 0.19, 1e-12, 'disque : longueur de corde × μ');
}

// 3. Transformée de Fourier rapide : comparée à la transformée discrète directe, puis aller-retour
{
  const N = 64, re = Float64Array.from({ length: N }, (_, i) => Math.sin(i * 0.37) + (i % 5) * 0.1), im = new Float64Array(N);
  const r2 = re.slice(), i2 = im.slice(); S.fft(r2, i2, false);
  for (const k of [0, 1, 7, 31, 50]) {
    let a = 0, b = 0; for (let t = 0; t < N; t++) { a += re[t] * Math.cos((-2 * Math.PI * k * t) / N); b += re[t] * Math.sin((-2 * Math.PI * k * t) / N); }
    close(r2[k], a, 1e-9, 'FFT partie réelle k = ' + k); close(i2[k], b, 1e-9, 'FFT partie imaginaire k = ' + k);
  }
  S.fft(r2, i2, true);
  ok(re.every((v, i) => Math.abs(v - r2[i]) < 1e-12), 'FFT inverse');
}

// 4. Le filtre rampe discret a bien la réponse |f| (Ram-Lak) aux basses fréquences
{
  const H = S.filterResponse(256, 0.1, 'ramlak');
  // fréquence ν = (k / M) / τ en cycles par cm : la réponse vaut |ν|
  for (const k of [8, 40, 100]) close(H.re[k], k / H.M / 0.1, 0.02, 'réponse égale à |ν| (k = ' + k + ')');
  ok(Math.abs(H.im[17]) < 1e-9, 'filtre réel (noyau symétrique)');
  const Hh = S.filterResponse(256, 0.1, 'hann');
  ok(Math.abs(Hh.re[H.M / 2]) < 1e-9 && Hh.re[H.M / 4] < H.re[H.M / 4], 'fenêtre de Hann : nulle à la fréquence maximale, plus douce');
}

// 5. Reconstruction d'un disque uniforme : la valeur au centre est retrouvée
{
  const disk = { fov: 20, ellipses: [[0, 0, 8, 8, 0, 0.2]], units: 'mu' };
  const acq = S.acquire(disk, { nA: 360, nD: 256 });
  const N = 128, rec = S.fbp(acq, N, 'ramlak');
  let mean = 0, cnt = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = ((i + 0.5) / N - 0.5) * 20, y = ((j + 0.5) / N - 0.5) * 20; if (x * x + y * y < 36) { mean += rec[j * N + i]; cnt++; } }
  close(mean / cnt, 0.2, 2e-3, 'rétroprojection filtrée : μ moyen dans le disque');
  close(rec[(N / 2) * N + N / 2], 0.2, 5e-3, 'valeur au centre');
  let out = 0; for (let i = 0; i < 6; i++) out = Math.max(out, Math.abs(rec[(N / 2) * N + i])); ok(out < 0.01, 'hors du disque : proche de 0');
}

// 6. Qualité selon les réglages : plus d'angles et plus de dose = image plus juste ; filtrée bien meilleure que simple
{
  const ph = S.PHANTOMS.thorax, N = 128, truth = S.phantomImage(ph, N);
  const err = (o, method = 'fbp', filt = 'shepp') => { const a = S.acquire(ph, Object.assign({ nD: 192, seed: 4 }, o)); const r = method === 'fbp' ? S.fbp(a, N, filt) : S.sart(a, N, 6).img; return S.compare(r, truth, N, 'hu').rmse; };
  const e30 = err({ nA: 30 }), e90 = err({ nA: 90 }), e360 = err({ nA: 360 });
  ok(e30 > e90 && e90 > e360, 'plus d’angles, moins d’erreur : ' + [e30, e90, e360].map((v) => v.toFixed(0)).join(' > ') + ' HU');
  const eLow = err({ nA: 360, I0: 2e3 }), eHigh = err({ nA: 360, I0: 1e6 });
  ok(eLow > 1.5 * eHigh, 'moins de dose, plus de bruit : ' + eLow.toFixed(0) + ' > ' + eHigh.toFixed(0) + ' HU');
  ok(err({ nA: 30 }, 'sart') < 0.7 * e30, 'peu d’angles : SART meilleur que la rétroprojection filtrée');
  const eLim = err({ nA: 120, range: 120 });
  ok(eLim > 2 * e360, 'rotation limitée à 120° : artefacts');
  // bruit : le filtre de Hann réduit l'erreur quand la dose est faible
  ok(err({ nA: 360, I0: 2e3 }, 'fbp', 'hann') < err({ nA: 360, I0: 2e3 }, 'fbp', 'ramlak'), 'faible dose : Hann moins bruité que Ram-Lak');
  // rétroprojection simple : image floue, corrélée à la vérité mais bien moins nette
  const a = S.acquire(ph, { nA: 180, nD: 192 }), bp = S.simpleBP(a, N), fb = S.fbp(a, N, 'shepp');
  const grad = (img) => { let g = 0; for (let j = 1; j < N; j++) for (let i = 1; i < N; i++) g += Math.abs(img[j * N + i] - img[j * N + i - 1]); return g; };
  ok(grad(bp) / grad(fb) < 0.5, 'rétroprojection simple floue');
}

// 7. Bruit de Poisson : écart-type de la mesure ≈ 1/√N photons
{
  const disk = { fov: 20, ellipses: [[0, 0, 8, 8, 0, 0.2]] };
  const clean = S.acquire(disk, { nA: 200, nD: 64 }), noisy = S.acquire(disk, { nA: 200, nD: 64, I0: 1e4, seed: 9 });
  const i = 32, p = clean.sino[i], expect = 1 / Math.sqrt(1e4 * Math.exp(-p));
  let m = 0, v = 0; for (let k = 0; k < 200; k++) m += noisy.sino[k * 64 + i]; m /= 200;
  for (let k = 0; k < 200; k++) v += (noisy.sino[k * 64 + i] - m) ** 2; v = Math.sqrt(v / 199);
  close(m, p, 0.01, 'mesure bruitée non biaisée'); close(v, expect, 0.15, 'écart-type ≈ 1/√N');
}

// 8. Implants métalliques : plus de photons « affamés » et des artefacts autour
{
  const N = 128, a = S.acquire(S.PHANTOMS.metal, { nA: 180, nD: 192, I0: 1e5, seed: 2 }), b = S.acquire(S.PHANTOMS.thorax, { nA: 180, nD: 192, I0: 1e5, seed: 2 });
  const low = (acq) => acq.counts.filter((c) => c < 10).length;
  ok(low(a) > low(b), 'métal : rayons presque entièrement absorbés');
  const tm = S.phantomImage(S.PHANTOMS.metal, N), tt = S.phantomImage(S.PHANTOMS.thorax, N);
  // erreur dans les tissus mous loin du métal (cœur)
  const zone = (rec, truth) => { let s = 0, c = 0; for (let j = 50; j < 70; j++) for (let i = 64; i < 80; i++) { s += (S.mu2hu(rec[j * N + i]) - S.mu2hu(truth[j * N + i])) ** 2; c++; } return Math.sqrt(s / c); };
  ok(zone(S.fbp(a, N, 'shepp'), tm) > zone(S.fbp(b, N, 'shepp'), tt), 'artefacts du métal jusque dans le cœur');
}

console.log('OK : ' + n + ' vérifications passent');
