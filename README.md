# 🏛️ Tafeline CMS – Restaurant Management System

![Node.js Version](https://img.shields.io/badge/node-%E2%89%A522-green)
![License MIT](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/badge/version-3.1.1-blue)

> Modulares CMS für Restaurants: Speisekarte, Reservierungen, Website-Editor, Warenkorb-System & Plugin-API.  
> **Komplett über den Browser einrichtbar – keine Konsole oder Server-SSH nach der Installation nötig.**

---

## 📋 Inhaltsverzeichnis

- [Voraussetzungen](#voraussetzungen)
- [Linux Server (Produktion)](#-linux-server-produktion)
- [Warenkorb & Online-Bestellung](#-warenkorb--online-bestellung)
- [Erster Start: Setup-Wizard](#-erster-start-setup-wizard)
- [.env Variablen-Referenz](#-env-variablen-referenz)
- [Lizenz aktivieren](#-lizenz-aktivieren)
- [Tech Stack](#-tech-stack)
- [Projektstruktur](#-projektstruktur)
- [Roadmap](#-roadmap)

---

## Voraussetzungen

**Linux Server (Produktion):**

- Ubuntu 22.04 / 24.04 oder Debian 12 (für `setup.sh` und `deploy.sh`)
- Root-Zugang bzw. `sudo` für `setup.sh` und `deploy.sh`
- Offene Ports: 80, 443 (nginx), optional 5000

**Lokal (Entwicklung):**

- Node.js ≥ 22
- npm ≥ 9
- **Native Build-Tools** (für `better-sqlite3`):
    - Ubuntu/Debian: `sudo apt install -y build-essential python3`
    - macOS: `xcode-select --install`

> Das Paket `@tafeline/plans` wird aus dem zentralen Repository `github:stb-srv/tafeline-plans` installiert (siehe `package.json`). CMS und Lizenzserver teilen sich damit **eine einzige Quelle** der Plan-Definitionen.

---

## 🚀 Linux Server (Produktion)

Zwei Skripte decken den gesamten Betrieb ab – für Ubuntu 22.04/24.04 und Debian 12, als `root` oder mit `sudo`:

| Skript                   | Wann                                   | Was                                                                           |
| ------------------------ | -------------------------------------- | ----------------------------------------------------------------------------- |
| [`setup.sh`](setup.sh)   | Einmalig, auf einem frischen Server    | Installiert alles Nötige und startet das CMS                                  |
| [`deploy.sh`](deploy.sh) | Bei jedem Update der laufenden Instanz | Holt den neuesten Stand, baut neu, startet neu – mit Backup und Auto-Rollback |

### Erstinstallation: `setup.sh`

```bash
sudo apt-get update && sudo apt-get install -y git
sudo git clone https://github.com/stb-srv/tafeline-cms.git /opt/tafeline-cms
sudo bash /opt/tafeline-cms/setup.sh
```

Das Skript fragt nur Domain, Port und (optional) die E-Mail für Let's Encrypt ab und erledigt dann alles selbst:

1. Systempakete (`git`, `openssl`, Build-Tools für `better-sqlite3`, `nginx`, bei HTTPS `certbot`)
2. Node.js 22 (NodeSource)
3. System-User `tafeline-cms` ohne Login-Shell
4. Code nach `/opt/tafeline-cms`
5. `.env` mit zufälligem `ADMIN_SECRET`, passendem `CORS_ORIGINS` und `HOST` (nur wenn noch keine existiert)
6. `npm ci` und Frontend-Build (`web/dist`)
7. systemd-Service `tafeline-cms` mit Autostart und Härtung
8. nginx als Reverse Proxy (inkl. WebSocket für Live-Bestellungen), Firewall-Regel (falls `ufw` aktiv ist), optional HTTPS per Let's Encrypt
9. Funktionstest

Zum Schluss stehen die Setup-URL (`https://<domain>/setup`) und der **Setup-Token** deutlich hervorgehoben in der Ausgabe (erneut anzeigen: `sudo bash setup.sh --show-token`). Den Rest (Admin-Zugang, Restaurantdaten, SMTP, Lizenz) erledigst du im [Setup-Wizard](#-erster-start-setup-wizard).

Ohne Rückfragen (z. B. für Automatisierung):

```bash
sudo bash setup.sh --yes --domain restaurant.example.de --email admin@example.de
```

| Option              | Bedeutung                                                         |
| ------------------- | ----------------------------------------------------------------- |
| `--domain <host>`   | Domain oder IP (Standard: `localhost`)                            |
| `--port <port>`     | Port des Node-Servers (Standard: `5000`)                          |
| `--email <adresse>` | Aktiviert HTTPS per Let's Encrypt (nur mit echter Domain + nginx) |
| `--no-nginx`        | Kein nginx; das CMS lauscht direkt auf `--port`                   |
| `--dir <pfad>`      | Installationsverzeichnis (Standard: `/opt/tafeline-cms`)          |
| `--branch <name>`   | Git-Branch (Standard: `main`)                                     |
| `-y`, `--yes`       | Keine Rückfragen                                                  |

`setup.sh` ist idempotent: Ein erneuter Lauf aktualisiert Pakete, Service und nginx, lässt aber `.env`, `server/config.json`, Datenbank und Uploads unangetastet.

### Updates: `deploy.sh`

```bash
sudo bash /opt/tafeline-cms/deploy.sh
```

Ablauf: neue Version prüfen → Backup (`server/database.sqlite` per SQLite-Online-Backup, `.env`, `server/config.json`) nach `deploy-backups/` (die letzten 10 bleiben) → Service stoppen → `git` auf `origin/main` → `npm ci` + Frontend-Build → Service starten → Funktionstest. Startet die neue Version nicht, rollt das Skript automatisch auf die vorherige zurück und zeigt die letzten Logzeilen. Ist schon alles aktuell, passiert nichts.

| Option            | Bedeutung                                         |
| ----------------- | ------------------------------------------------- |
| `--branch <name>` | Anderen Branch deployen (Standard: `main`)        |
| `--force`         | Auch deployen, wenn schon der neueste Stand läuft |
| `--no-backup`     | Backup überspringen (nicht empfohlen)             |

Lokale Änderungen an versionierten Dateien werden überschrieben; vorher landet ein Patch im Backup-Ordner. Während des Updates ist das CMS kurz (Dauer des Builds) nicht erreichbar. `uploads/` wird nicht angefasst und nicht gesichert.

### Komplette Neuinstallation mit bestehenden Daten

Auf dem neuen Server zuerst `setup.sh` ausführen, dann `.env`, `server/config.json`, `server/database.sqlite` und `uploads/` aus dem Backup nach `/opt/tafeline-cms/` kopieren, Besitzer auf `tafeline-cms` setzen und `sudo systemctl restart tafeline-cms` ausführen. Das Setup muss dann nicht erneut durchlaufen werden.

> Bei kleinen Servern (unter 2 GB RAM) kann der Frontend-Build knapp werden – dann vorübergehend Swap anlegen.

---

## 🛒 Warenkorb & Online-Bestellung

Tafeline CMS verfügt über ein integriertes Warenkorb-System für Gäste.

- **Dine-In**: Gäste scannen einen QR-Code am Tisch und bestellen direkt an ihre Tischnummer.
- **Abholung (Pickup)**: Bestellen von zu Hause mit Angabe der gewünschten Abholzeit.
- **Lieferung (Delivery)**: Integriertes Formular für Lieferadresse und Kontaktdaten.
- **Vollständig Clientseitig**: Der Warenkorb nutzt den LocalStorage – kein Login für Gäste erforderlich.
- **Status-Steuerung**: Bestellungen können im Admin-Panel pro Modus (Tisch/Abholung/Lieferung) aktiviert oder deaktiviert werden.

---

## 🧙 Erster Start: Setup-Wizard

Beim ersten Start wird ein **Setup-Token** erzeugt – den brauchst du im ersten Wizard-Schritt. Er ist leicht wiederzufinden:

- am Ende von `setup.sh` (hervorgehoben ausgegeben)
- jederzeit erneut: `sudo bash /opt/tafeline-cms/setup.sh --show-token`
- in der Datei `/opt/tafeline-cms/SETUP-INFO.txt` (Rechte 600, nicht im Repo; wird nach der Ersteinrichtung automatisch gelöscht)
- in der Konsole bzw. im Journal (`journalctl -u tafeline-cms | grep Token`)

Das Token gilt bis zum nächsten Neustart des Services; danach wird ein neues erzeugt und `SETUP-INFO.txt` aktualisiert.

Ausgabe in der Konsole:

```
════════════════════════════════════════════════════════════
  TAFELINE CMS – ERSTEINRICHTUNG ERFORDERLICH
════════════════════════════════════════════════════════════
  Öffne:  http://localhost:5000/setup
  Token:  a3f7b9c2d1e4f6a8b0c2d3e5f7a9b1c3
════════════════════════════════════════════════════════════
```

Öffne die angezeigte URL im Browser und folge den 4 Schritten:

| Schritt            | Inhalt                                                                      |
| ------------------ | --------------------------------------------------------------------------- |
| **1 – Zugang**     | Setup-Token (siehe oben) · Admin-Name · E-Mail · Passwort (min. 12 Zeichen) |
| **2 – Restaurant** | Name · Telefon · Adresse · Sprache · Zeitzone · Website                     |
| **3 – System**     | Lizenzschlüssel (optional) · Datenbanktyp (SQLite empfohlen)                |
| **4 – E-Mail**     | SMTP-Daten für Bestätigungs-Mails (optional, auch später einstellbar)       |

Am Ende werden **Recovery-Codes** angezeigt – **unbedingt sicher aufbewahren**, da sie nur einmalig sichtbar sind.

Der Wizard schreibt automatisch `server/config.json` inkl. eines zufälligen `ADMIN_SECRET` – **kein manuelles Setzen in `.env` nötig**. Diese Datei niemals committen.

---

## ⚙️ .env Variablen-Referenz

| Variable              | Beschreibung                                                | Standard    |
| --------------------- | ----------------------------------------------------------- | ----------- |
| `PORT`                | Port des Express-Servers                                    | `5000`      |
| `ADMIN_SECRET`        | JWT Signing Key – wird automatisch vom Setup-Wizard gesetzt | –           |
| `CORS_ORIGINS`        | Erlaubte Frontend-Domains, kommagetrennt                    | `localhost` |
| `SMTP_HOST`           | SMTP Server                                                 | –           |
| `SMTP_PORT`           | SMTP Port                                                   | `465`       |
| `SMTP_USER`           | SMTP Benutzername                                           | –           |
| `SMTP_PASS`           | SMTP Passwort                                               | –           |
| `SMTP_FROM`           | Absender-Adresse                                            | –           |
| `BACKUP_DIR`          | Verzeichnis für Backups                                     | `./backups` |
| `BACKUP_MAX_AGE_DAYS` | Backups älter als X Tage löschen                            | `30`        |
| `BACKUP_MIN_COUNT`    | Mindestanzahl Backups behalten                              | `7`         |
| `PEXELS_API_KEY`      | Key für automatische Speisefotos                            | –           |
| `UNSPLASH_ACCESS_KEY` | Zweiter Key für Speisefotos                                 | –           |

> SMTP kann alternativ vollständig über den Setup-Wizard / Admin-Panel konfiguriert werden.

---

## 🔑 Lizenz aktivieren

Das System bietet verschiedene Pläne. Die Aktivierung erfolgt im CMS unter **Einstellungen → Lizenz**.

| Plan             | Gerichte | Tische | Highlights                     |
| ---------------- | -------- | ------ | ------------------------------ |
| **Free** (Trial) | 30       | 5      | Speisekarte verwalten          |
| **Starter**      | 60       | 10     | Reservierungen & Bestellungen  |
| **Pro**          | 150      | 25     | Custom Design                  |
| **Pro+**         | 300      | 50     | Analytics, Online-Bestellungen |
| **Enterprise**   | 999      | 999    | Alle Module inkl. QR-Pay       |

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, Pino (Logging), Helmet (Security-Header), Zod (Validierung)
- **Datenbank**: SQLite (`better-sqlite3`)
- **Auth**: JWT (RS256 für Lizenz, HS256 für Admin-Sessions), bcryptjs
- **Frontend**: Vanilla JS (ES Modules), CSS Custom Properties (Glassmorphism)
- **Realtime**: Socket.io (Bestelleingänge → Kitchen-Display)
- **E-Mail**: Nodemailer (SMTP konfigurierbar über Admin-UI)
- **PDF**: PDFKit (Bon-Druck / Exporte)

---

## 📁 Projektstruktur

```
/
├── server.js              # Entry Point, Plugin-Loader, HTTP-Server
├── config.js              # Konfigurations-Loader (config.json > .env)
├── server/
│   ├── app.js             # Express-App, alle Route-Mounts, CORS/Helmet
│   ├── database.js        # SQLite-Adapter (better-sqlite3)
│   ├── middleware.js      # requireAuth, requireRole, requireLicense
│   ├── license.js         # PLAN_DEFINITIONS, getCurrentLicense
│   ├── cron.js            # Background-Jobs (Trial, Reminder, Backup-Cleanup)
│   ├── socket.js          # Socket.IO Setup
│   ├── mailer.js          # E-Mail Versand
│   ├── routes/            # API Endpunkte (auth, menu, orders, cart, ...)
│   └── validation/        # Zod-Schemas + validate()-Middleware
├── cms/                   # Admin-Panel (ES Modules, Vanilla JS)
│   └── modules/           # CMS-Module (menu, orders, reservations, ...)
├── menu-app/              # Gäste-Frontend
│   ├── i18n/              # 14 Sprachen (DE, EN, EL, ES, FR, IT, ...)
│   └── cart.js            # Warenkorb-Logik (clientseitig, LocalStorage)
├── plugins/               # Erweiterungs-Schnittstelle
└── scripts/               # Utility-Scripts (auto-images, create-admin, ...)
```

---

## 🗺️ Roadmap

- [ ] Gutschein-System (digitale Geschenkkarten)
- [ ] Google Reviews Integration
- [ ] QR-Pay (Bezahlung am Tisch)
- [ ] Docker Compose Support
