# HarmonyLab – README

HarmonyLab er en lille React + Tone.js webapp, hvor du kan synge (mikrofon) eller afspille en sang (fil), og appen laver hurtige harmonier (f.eks. +3 og +5). Den kan også optage og give dig et download af mixet.

## Funktioner
- Live input via mikrofon
- Afspilning af uploadede lydfiler
- Automatisk genererede harmonier (+3, +5, -3, -5 semitoner)
- Individuel kontrol over niveau for hver harmoni
- Visuel meter og input-niveau (potmeter)
- Optagelse og eksport af mix som lydfil

## Teknologi
- [React](https://react.dev/) – UI framework
- [Vite](https://vitejs.dev/) – build tooling
- [Tone.js](https://tonejs.github.io/) – Web Audio bibliotek
- [Tailwind CSS](https://tailwindcss.com/) – styling
- [Vercel](https://vercel.com/) – hosting (https, nødvendig for mikrofon på mobil)

## Projektstruktur
```
/ (repo rod)
  package.json
  vite.config.ts
  index.html
  tailwind.config.js
  postcss.config.js
  tsconfig.json
  /src
    main.tsx
    index.css
    App.tsx
    HarmonyLab.tsx
```

## Installation og kørsel lokalt
```bash
npm install
npm run dev
```

## Deploy
Projektet kan hostes direkte på Vercel. Når det er deployet, får du en https://…vercel.app URL, som kan åbnes både på desktop og mobil (HTTPS er nødvendigt for mikrofon).

## Fremtidige forbedringer
- PWA (installérbar app på mobil)
- Clip/peak indikator i potmeteret
- Avancerede harmonier ud fra skala/akkorder

---

Se `src/HarmonyLab.tsx` for den komplette komponentkode.
