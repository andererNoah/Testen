# ADR-0008: Web-Oberfläche als React-SPA mit Vite und React Aria

Status: angenommen · 18.10.2026 · Abweichung vom Stack-Vorschlag (Next.js)

## Entscheidung

- React 19 + TypeScript, gebaut mit Vite, Routing mit React Router, Server-Zustand mit TanStack Query.
- Kein Next.js: Die Architektur verlangt, dass alle Oberflächen nur über die API sprechen. Eine SPA hat keine zweite Server-Schicht, die diese Regel aufweichen könnte, und lässt sich später ohne Umbau zur PWA erweitern (Entscheidung des Auftraggebers: PWA später).
- Eigenes Designsystem (`apps/web/src/ui`) auf **React Aria Components** (Adobe, Apache 2.0): Tastaturbedienung, Fokusführung und ARIA-Semantik sind dort geprüft. Ziel: WCAG 2.2 AA.
- Design-Tokens als CSS-Variablen, heller und dunkler Modus.

## Konsequenzen

- SEO und Server-Rendering spielen für eine Verwaltungsoberfläche hinter Login keine Rolle.
- Portale (Mieter, Eigentümer) werden in Phase 1 als eigene App auf demselben Designsystem gebaut; dann wird das Designsystem in ein Paket `packages/ui` ausgelagert.
