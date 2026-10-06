# Changelog

Alle wesentlichen Änderungen an diesem Projekt werden hier dokumentiert.
Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).

---

## [Unreleased]

### Added

- Tests für Bestellungen und Reservierungen (Validierung, Lizenz-Gating, Rollenrechte).

### Changed

- **MySQL/MariaDB-Unterstützung entfernt** – das CMS nutzt ausschließlich SQLite (`better-sqlite3`). `DB_TYPE`, `DB_*`-Variablen, `migrate-to-mysql.sh` und `mysql2` entfallen.
- Abhängigkeiten aktualisiert (Express 5, Nodemailer, multer, pino, ESLint 10 u. a.); `npm audit` meldet 0 Schwachstellen (Backend und Frontend).
- ESLint-Konfiguration repariert, Code mit Prettier formatiert, TypeScript-Fehler im Frontend behoben (Tagesgerichte-Suche nutzte ein nicht existierendes Feld).
- CI führt Lint, Format-Check, Tests, Audit, Typecheck und Web-Build aus.
- Neue API-Tests (Login, Auth-Schutz, Rollen, öffentliche Endpunkte).

### Geplant

- Docker Compose Support
- Grace-Period für Token-Ablauf (CMS läuft bei Heartbeat-Fehler noch 24–48h weiter)
- Trial-Lizenz Reset-Limit
- OpenAPI/Swagger-Dokumentation

### Sicherheit (offen)

- **SEC-04**: Plugin-System ohne Code-Signing – Plugins werden ohne Hash/Signatur-Prüfung geladen. Geplant: Integritäts-Check vor dem Laden.

---

## [3.1.1] – 2026-05-xx

### Hinzugefügt

- Setup-Wizard (erster Start via `/setup`, schreibt `server/config.json`, erstellt Admin-User + Trial-Lizenz)
- Backup-System mit automatischem Cleanup (cron, konfigurierbar via `BACKUP_MAX_AGE_DAYS` / `BACKUP_MIN_COUNT`)
- Tisch-Planer (Drag & Drop im Admin-Panel, Grundriss-Editor)
- Gäste-Frontend Mehrsprachigkeit: 14 Sprachen (DE, EN, EL, ES, FR, IT, NL, PL, PT, RU, TR, UK, AR, DA)
- Zod-Validierung für alle API-Endpunkte (`server/validation/`)
- `requireRole`-Middleware für rollenbasierte Zugangskontrolle (admin / waiter / kitchen)
- Cookie-Banner und DSGVO-Consent-Management
- AI-Bildvorschläge für Speisen (`/api/image-ai`)
- Reservierungs-Erinnerungs-E-Mails (Cron, täglich 10:00 Uhr Berlin)
- Socket.IO Real-time Push für Bestelleingänge (Kitchen-Display)
- Plugin-System: Drittanbieter-Erweiterungen via `plugins/<id>/`
- `deepMerge` in Settings-Routen (partielle Updates ohne Überschreiben)

### Sicherheit

- **SEC-02**: `requireLicense` prüft jetzt immer das RS256-signierte JWT via `verifyLicenseToken()` statt rohem DB-Cache
- **SEC-04**: Path-Traversal-Schutz beim Plugin-Laden
- Helmet Security-Header (inkl. CSP)
- Rate-Limiter auf Login, Passwort-Vergessen und Reservierungen

### Geändert

- Plan-Limits mit License-Server synchronisiert (FREE: 30, STARTER: 60, PRO: 150, PRO+: 300, ENTERPRISE: 999 Gerichte)
- RSA Public Key wird beim Start automatisch vom Lizenzserver geladen; `LICENSE_PUBLIC_KEY` Env-Variable überschreibt diesen
- Offline-Fallback: letzter bekannter Plan bleibt aktiv wenn Lizenzserver nicht erreichbar
- `ADMIN_SECRET = Default-Wert` blockiert Server-Start nach abgeschlossenem Setup (SEC-04)

---

## [1.0.0] – 2026-04-12

### Hinzugefügt

- CMS als modulares Node.js/Express-System mit SQLite/JSON-KV-Datenbank
- RS256-JWT-Token-Verifikation mit Domain-Binding
- Trial-Lizenz-System mit Ablaufprüfung
- Heartbeat-Mechanismus (alle 23h) zum License-Server
- Offline-Token-Verifikation (bis 168h)
- Plugin-System mit dynamischem Laden aus `plugins/`
- Rate Limiting auf Login, Passwort-Vergessen und Reservierungen
- Admin-Dashboard mit JWT-Session-Auth
- SMTP-Konfiguration per Env oder Admin-UI
- Deploy-Skripte für Ubuntu/Linux und Windows
