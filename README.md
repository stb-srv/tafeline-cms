# 🏛️ Tafeline CMS – Restaurant Management System

![Node.js Version](https://img.shields.io/badge/node-%E2%89%A518-green)
![License MIT](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/badge/version-3.1.1-blue)

> Modulares CMS für Restaurants: Speisekarte, Reservierungen, Website-Editor, Warenkorb-System & Plugin-API.  
> **Komplett über den Browser einrichtbar – keine Konsole oder Server-SSH nach der Installation nötig.**

---

## 📋 Inhaltsverzeichnis

- [Voraussetzungen](#voraussetzungen)
- [Linux Server Setup (Empfohlen)](#-linux-server-setup-empfohlen)
- [MySQL/MariaDB Setup](#-mysqlmariadb-setup)
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

- Ubuntu 22.04 / 24.04, Debian 12 oder Rocky Linux 9
- Root-Zugang (einmalig für das Installer-Skript)
- Offene Ports: 80, 443 (nginx), optional 5000

**Lokal (Entwicklung):**

- Node.js ≥ 18
- npm ≥ 9
- **Native Build-Tools** (für `better-sqlite3`):
    - Ubuntu/Debian: `sudo apt install -y build-essential python3`
    - macOS: `xcode-select --install`

> Das Paket `@tafeline/plans` wird aus dem zentralen Repository `github:stb-srv/tafeline-plans` installiert (siehe `package.json`). CMS und Lizenzserver teilen sich damit **eine einzige Quelle** der Plan-Definitionen.

---

## 🚀 Linux Server Setup (Empfohlen)

Dies ist der empfohlene Weg für den Produktivbetrieb mit **PM2** als Prozessmanager.

```bash
# 1. Repository klonen
git clone https://github.com/stb-srv/tafeline-cms.git /opt/meraki-cms
cd /opt/meraki-cms

# 2. Installer starten
chmod +x install-ubuntu.sh
sudo ./install-ubuntu.sh
```

---

## 🗄️ MySQL/MariaDB Setup

Standardmäßig nutzt Tafeline CMS **SQLite** (kein Setup nötig). Für größere Installationen oder Shared-Hosting (Netcup, Hetzner etc.) wird **MySQL/MariaDB** empfohlen.

1. Erstelle eine neue Datenbank und einen Benutzer.
2. Trage in der `.env` Datei folgende Werte ein:

```env
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=dein_benutzer
DB_PASS=dein_passwort
DB_NAME=deine_db_name
DB_SSL=false
```

3. Starte den Server neu. Das Schema wird automatisch inkl. aller Migrationen erstellt.

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

Beim ersten Start erscheint in der Konsole ein **Setup-Token** – den brauchst du im ersten Wizard-Schritt:

```
════════════════════════════════════════════════════════════
  TAFELINE CMS – ERSTEINRICHTUNG ERFORDERLICH
════════════════════════════════════════════════════════════
  Öffne:  http://localhost:5000/setup
  Token:  a3f7b9c2d1e4f6a8b0c2d3e5f7a9b1c3
════════════════════════════════════════════════════════════
```

Öffne die angezeigte URL im Browser und folge den 4 Schritten:

| Schritt            | Inhalt                                                                         |
| ------------------ | ------------------------------------------------------------------------------ |
| **1 – Zugang**     | Setup-Token aus der Konsole · Admin-Name · E-Mail · Passwort (min. 12 Zeichen) |
| **2 – Restaurant** | Name · Telefon · Adresse · Sprache · Zeitzone · Website                        |
| **3 – System**     | Lizenzschlüssel (optional) · Datenbanktyp (SQLite empfohlen)                   |
| **4 – E-Mail**     | SMTP-Daten für Bestätigungs-Mails (optional, auch später einstellbar)          |

Am Ende werden **Recovery-Codes** angezeigt – **unbedingt sicher aufbewahren**, da sie nur einmalig sichtbar sind.

Der Wizard schreibt automatisch `server/config.json` inkl. eines zufälligen `ADMIN_SECRET` – **kein manuelles Setzen in `.env` nötig**. Diese Datei niemals committen.

---

## ⚙️ .env Variablen-Referenz

| Variable              | Beschreibung                                                | Standard    |
| --------------------- | ----------------------------------------------------------- | ----------- |
| `PORT`                | Port des Express-Servers                                    | `5000`      |
| `ADMIN_SECRET`        | JWT Signing Key – wird automatisch vom Setup-Wizard gesetzt | –           |
| `CORS_ORIGINS`        | Erlaubte Frontend-Domains, kommagetrennt                    | `localhost` |
| `DB_TYPE`             | `sqlite` oder `mysql`                                       | `sqlite`    |
| `DB_HOST`             | Hostname der MySQL DB                                       | `localhost` |
| `DB_PORT`             | Port der MySQL DB                                           | `3306`      |
| `DB_USER`             | Benutzername MySQL                                          | –           |
| `DB_PASS`             | Passwort MySQL                                              | –           |
| `DB_NAME`             | Datenbankname                                               | –           |
| `DB_SSL`              | SSL für DB-Verbindung (`true`/`false`)                      | `false`     |
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
- **Datenbank**: SQLite (`better-sqlite3`) ODER MySQL/MariaDB (`mysql2`)
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
│   ├── database-mysql.js  # MySQL/MariaDB-Adapter
│   ├── db.js              # Adapter-Selector (DB_TYPE)
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
