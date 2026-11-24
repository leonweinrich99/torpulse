# TorPulse – Live Fußball PWA

Mobile-first Fußball-Ergebnisse & Live-Ticker im OneFootball-Design, angetrieben von der [OpenLigaDB API](https://www.openligadb.de/) und gehostet auf **Firebase Hosting** als vollwertige **Progressive Web App (PWA)**.

## Features (100% OpenLigaDB-Abdeckung)

- **Spiele & Live-Ticker**
  - Spieltag-Ansicht & Kalender-Ansicht (±7 Tage + freie Datumsauswahl)
  - Live-Filter mit automatischem Smart-Polling über `/getlastchangedate`
  - Echtzeit-Statuserkennung (Live-Minute, Halbzeit, FT, n.V., n.E.)
- **Match Center**
  - Detailliertes Scoreboard mit Halbzeitstand, Stadion, Stadt, Zuschauerzahl & Countdown
  - Chronologische Tor-Timeline mit Elfmeter-, Eigentor- & Nachspielzeit-Kennzeichnung
  - Historischer Direktvergleich (H2H) mit Siegesbilanz & Torverhältnis
  - Live-Tabellenkontext & Ergebnis-Aufschlüsselung
  - Deep-Links & Native Share API
- **Wettbewerbe & Liga-Hub**
  - Kuratierte Top-Ligen (1. BL, 2. BL, 3. Liga, DFB-Pokal, UCL, UEL, UECL, Frauen-BL, Premier League, Österr. BL, Eredivisie, WM 2026, Nations League)
  - Vollständiger OpenLigaDB-Katalog-Explorer für alle Saisons & Sportarten
  - Tabellen (Gesamt, Heim, Auswärts, Gruppe) mit Zonencodierung & 5-Spiele-Formkurve
  - Torjägerliste (angereichert mit Vereinswappen & Elfmeter-Statistik)
  - Team-Filter für alle Saisonspiele & Nächstes/Letztes Spiel
- **Team-Hub & Favoriten**
  - Vereins-Detailansicht mit Formkurve, kommenden & vergangenen Spielen über alle Wettbewerbe und H2H-Gegnervergleich
  - Favoriten-Tab für Lieblingsvereine & -ligen (lokal gespeichert)
- **PWA & Offline-Modus**
  - Installierbar auf iOS & Android (`manifest.webmanifest`, Service Worker mit Workbox)
  - Offline-Fallback durch Cache-Layer & API-Rate-Limit-Telemetrie
  - Dunkel-, Hell- & System-Design

## Entwicklung

```bash
npm install
npm run dev
npm run test
npm run build
```

## Deployment (Firebase Hosting)

```bash
npm run build
firebase deploy --only hosting
```
