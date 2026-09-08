# ToolPulse

Eine Web-App, die täglich die aktuell besten Tools für **KI & LLMs, Bilder,
Haushalt, Essen & Trinken, Freizeit und Kinder** zeigt – personalisiert, mit
Vertrauens-Score, Preisfilter, Vergleichsfunktion, Merkliste mit
Wiedervorlage und Wochen-Digest.

## Wie die App aufgebaut ist

```
src/
  data/           Kategorien + Demo-/Seed-Daten (nur für Demo-Modus)
  lib/firebase.ts Firebase-Init mit automatischem Demo-Modus-Fallback
  context/        Auth (Google-Login) und Vergleichs-Auswahl
  hooks/          Firestore-Zugriff: Tools, Präferenzen, Merkliste
  components/     ToolCard, FilterBar, TrustBadge, Header
  pages/          Feed, Vergleich, Merkliste, Wochen-Digest, Einstellungen
functions/
  index.js        Tägliche Cloud Function: recherchiert per Claude + Websuche
                   und schreibt Ergebnisse nach Firestore
firestore.rules    Zugriffsregeln (Tools öffentlich lesbar, Nutzerdaten privat)
```

### Demo-Modus

Ohne Firebase-Konfiguration läuft die App trotzdem: Sie zeigt lokale
Beispiel-Tools und speichert Einstellungen/Merkliste im Browser
(`localStorage`) statt in Firestore. So funktioniert die Vercel-Vorschau
sofort, ohne dass du zuerst ein Firebase-Projekt einrichten musst. Sobald du
die `VITE_FIREBASE_*`-Umgebungsvariablen setzt (siehe unten), wechselt die
App automatisch in den Live-Modus mit echtem Google-Login und Firestore.

## Einrichtung — Schritt für Schritt

### 1. Firebase-Projekt anlegen

1. [Firebase Console](https://console.firebase.google.com) → "Projekt
   hinzufügen".
2. **Authentication** aktivieren → Anbieter "Google" einschalten.
3. **Firestore Database** anlegen (Produktionsmodus).
4. Unter Projekteinstellungen → "Meine Apps" → Web-App hinzufügen. Die dort
   angezeigten Werte in eine `.env`-Datei (Kopie von `.env.example`)
   eintragen:

   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

5. Firestore-Regeln deployen:

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add        # dein Projekt auswählen
   firebase deploy --only firestore:rules,firestore:indexes
   ```

### 2. Lokal starten

```bash
npm install
npm run dev
```

### 3. Tägliche Kuratierung einrichten (Cloud Function)

Die Funktion in `functions/index.js` fragt täglich per Claude-API mit
Websuche nach aktuellen Tools je Bereich und schreibt sie nach Firestore.
Dafür brauchst du einen Anthropic-API-Key (console.anthropic.com):

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
cd functions && npm install && cd ..
firebase deploy --only functions
```

Das Firebase-Projekt muss dafür auf dem **Blaze-Tarif** (Pay-as-you-go) sein
— Cloud Functions mit geplanten Ausführungen (Cloud Scheduler) benötigen
das, auch wenn die tatsächlichen Kosten bei einem Lauf pro Tag gering sind.

Zum Testen ohne auf 6 Uhr zu warten, gibt es einen manuellen HTTP-Trigger
(`runCurationNow`) — die URL zeigt `firebase deploy` nach dem Deploy an.

### 4. Auf GitHub speichern

```bash
git init
git add .
git commit -m "ToolPulse: initiale Version"
git branch -M main
git remote add origin https://github.com/<dein-nutzername>/toolpulse.git
git push -u origin main
```

`.env` ist bereits in `.gitignore` — Firebase-Keys landen nicht im Repo.
Trag die `VITE_FIREBASE_*`-Werte stattdessen als Vercel-Umgebungsvariablen
ein (siehe unten).

### 5. Auf Vercel deployen

1. Auf [vercel.com](https://vercel.com) → "Add New Project" → das
   GitHub-Repo auswählen.
2. Framework-Preset: **Vite** (wird automatisch erkannt).
3. Unter "Environment Variables" die sechs `VITE_FIREBASE_*`-Werte aus
   Schritt 1 eintragen.
4. Deploy. Jeder Push auf `main` aktualisiert die Live-Version automatisch.

## Was noch erweitert werden kann

- **Push-Benachrichtigungen** bei "Tool des Tages": Firebase Cloud
  Messaging + Service Worker, angestoßen am Ende von `runCuration()`.
- **Bessere Trust-Score-Berechnung**: aktuell eine einfache Heuristik nach
  Quellenanzahl. Ließe sich durch mehrere unabhängige Suchanfragen pro Tool
  und echten Abgleich verbessern.
- **Weitere/eigene Kategorien**: `src/data/categories.ts` erweitern und die
  gleiche ID in `functions/index.js` (`CATEGORIES`) ergänzen.
- **E-Mail-Digest**: die wöchentliche Zusammenfassung aus `DigestPage.tsx`
  ließe sich per Cloud Function und z. B. SendGrid auch als E-Mail
  verschicken.
