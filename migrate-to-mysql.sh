#!/usr/bin/env bash
# =============================================================================
# Tafeline CMS – SQLite → MySQL/MariaDB Migrationsskript
# =============================================================================
# Verwendung:
#   chmod +x migrate-to-mysql.sh
#   ./migrate-to-mysql.sh
#
# Voraussetzungen auf dem Server:
#   - Node.js >= 18
#   - sqlite3 CLI (apt install sqlite3 / yum install sqlite)
#   - mysql CLI (apt install mysql-client / mariadb-client)
#   - npm install mysql2 (wird automatisch gemacht wenn nicht vorhanden)
# =============================================================================

set -euo pipefail

# Farben
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[✓]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[FEHLER]${NC} $*"; }
step()    { echo -e "\n${BOLD}${CYAN}=== $* ===${NC}"; }

echo -e "${BOLD}"
echo "  ┌─────────────────────────────────────────────┐"
echo "  │   Tafeline CMS – SQLite → MySQL Migration        │"
echo "  └─────────────────────────────────────────────┘"
echo -e "${NC}"

# =============================================================================
# SCHRITT 1: Voraussetzungen prüfen
# =============================================================================
step "Voraussetzungen prüfen"

for cmd in node npm sqlite3 mysql; do
    if command -v "$cmd" &>/dev/null; then
        success "$cmd gefunden: $(command -v $cmd)"
    else
        if [ "$cmd" = "sqlite3" ]; then
            warn "sqlite3 CLI nicht gefunden. Wird installiert..."
            if command -v apt-get &>/dev/null; then
                sudo apt-get install -y sqlite3 2>/dev/null || error "sqlite3 konnte nicht installiert werden."
            elif command -v yum &>/dev/null; then
                sudo yum install -y sqlite 2>/dev/null || error "sqlite3 konnte nicht installiert werden."
            fi
        elif [ "$cmd" = "mysql" ]; then
            warn "mysql CLI nicht gefunden. Wird installiert..."
            if command -v apt-get &>/dev/null; then
                sudo apt-get install -y mysql-client 2>/dev/null || \
                sudo apt-get install -y mariadb-client 2>/dev/null || \
                error "mysql-client konnte nicht installiert werden."
            elif command -v yum &>/dev/null; then
                sudo yum install -y mysql 2>/dev/null || error "mysql konnte nicht installiert werden."
            fi
        else
            error "$cmd ist nicht installiert!"
            exit 1
        fi
    fi
done

# =============================================================================
# SCHRITT 2: SQLite-Datei lokalisieren
# =============================================================================
step "SQLite-Datenbankdatei finden"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQLITE_DEFAULT="${SCRIPT_DIR}/server/database.sqlite"

echo ""
read -p "$(echo -e "${BOLD}Pfad zur SQLite-Datei${NC} [${SQLITE_DEFAULT}]: ")" SQLITE_PATH
SQLITE_PATH="${SQLITE_PATH:-$SQLITE_DEFAULT}"

if [ ! -f "$SQLITE_PATH" ]; then
    error "SQLite-Datei nicht gefunden: $SQLITE_PATH"
    exit 1
fi
success "SQLite-Datei: $SQLITE_PATH"

# =============================================================================
# SCHRITT 3: MySQL-Verbindungsdaten abfragen
# =============================================================================
step "MySQL/MariaDB Verbindungsdaten"
echo -e "${YELLOW}Bitte gib die Zugangsdaten für deine Netcup / Remote MySQL-Datenbank ein:${NC}"
echo ""

read -p "$(echo -e "${BOLD}MySQL Host${NC} [localhost]: ")" DB_HOST
DB_HOST="${DB_HOST:-localhost}"

read -p "$(echo -e "${BOLD}MySQL Port${NC} [3306]: ")" DB_PORT
DB_PORT="${DB_PORT:-3306}"

read -p "$(echo -e "${BOLD}Datenbankname${NC} [tafeline_cms]: ")" DB_NAME
DB_NAME="${DB_NAME:-tafeline_cms}"

read -p "$(echo -e "${BOLD}Benutzername${NC} [tafeline_cms_user]: ")" DB_USER
DB_USER="${DB_USER:-opa_cms_user}"

read -s -p "$(echo -e "${BOLD}Passwort${NC}: ")" DB_PASS
echo ""

read -p "$(echo -e "${BOLD}SSL verwenden?${NC} (j/N): ")" USE_SSL
USE_SSL=$(echo "${USE_SSL:-n}" | tr '[:upper:]' '[:lower:]')

# =============================================================================
# SCHRITT 4: Verbindung testen
# =============================================================================
step "Datenbankverbindung testen"

MYSQL_BASE_ARGS="-h${DB_HOST} -P${DB_PORT} -u${DB_USER} -p${DB_PASS}"

if mysql ${MYSQL_BASE_ARGS} -e "SELECT 1;" "${DB_NAME}" &>/dev/null; then
    success "Verbindung zu ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME} erfolgreich!"
else
    error "Verbindung fehlgeschlagen! Bitte Host, Port, Benutzer, Passwort und Datenbankname prüfen."
    exit 1
fi

# =============================================================================
# SCHRITT 5: Backup der SQLite-Datei
# =============================================================================
step "Backup erstellen"

BACKUP_PATH="${SQLITE_PATH}.backup-$(date +%Y%m%d-%H%M%S)"
cp "$SQLITE_PATH" "$BACKUP_PATH"
success "Backup erstellt: $BACKUP_PATH"

# =============================================================================
# SCHRITT 6: MySQL-Schema erstellen
# =============================================================================
step "MySQL-Schema erstellen"

mysql ${MYSQL_BASE_ARGS} "${DB_NAME}" <<'SQL'
CREATE TABLE IF NOT EXISTS kv_store (
    `key`  VARCHAR(255) PRIMARY KEY,
    value  LONGTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
    user                    VARCHAR(100) PRIMARY KEY,
    pass                    TEXT NOT NULL,
    name                    TEXT,
    last_name               TEXT,
    email                   TEXT,
    role                    VARCHAR(50) DEFAULT 'admin',
    require_password_change TINYINT(1) DEFAULT 0,
    recovery_codes          LONGTEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS menu (
    id        VARCHAR(100) PRIMARY KEY,
    number    VARCHAR(50),
    name      TEXT NOT NULL,
    price     DOUBLE,
    cat       TEXT,
    `desc`    LONGTEXT,
    allergens LONGTEXT,
    additives LONGTEXT,
    image     TEXT,
    active    TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
    id         VARCHAR(100) PRIMARY KEY,
    label      TEXT NOT NULL,
    icon       TEXT,
    active     TINYINT(1) DEFAULT 1,
    sort_order INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reservations (
    id              BIGINT PRIMARY KEY,
    token           VARCHAR(100) UNIQUE,
    name            TEXT,
    email           TEXT,
    phone           TEXT,
    date            VARCHAR(20),
    time            VARCHAR(30),
    start_time      VARCHAR(10),
    end_time        VARCHAR(10),
    guests          INT DEFAULT 1,
    note            LONGTEXT,
    status          VARCHAR(50) DEFAULT 'Pending',
    assigned_tables LONGTEXT,
    submittedAt     VARCHAR(50),
    ip              VARCHAR(50)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tables` (
    id         VARCHAR(100) PRIMARY KEY,
    name       TEXT NOT NULL,
    capacity   INT DEFAULT 2,
    combinable TINYINT(1) DEFAULT 1,
    active     TINYINT(1) DEFAULT 1,
    area_id    VARCHAR(100) DEFAULT 'main'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
    id         VARCHAR(100) PRIMARY KEY,
    table_id   VARCHAR(100),
    table_name TEXT,
    status     VARCHAR(50) DEFAULT 'pending',
    timestamp  VARCHAR(50),
    total      DOUBLE DEFAULT 0,
    note       LONGTEXT,
    items      LONGTEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SQL

success "Schema erstellt."

# =============================================================================
# SCHRITT 7: Daten aus SQLite exportieren und in MySQL importieren
# =============================================================================
step "Daten migrieren"

TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

TABLES=("kv_store" "users" "menu" "categories" "reservations" "tables" "orders")

migrate_table() {
    local TABLE="$1"
    info "Migriere Tabelle: ${TABLE}"

    # Zeilen zählen
    local COUNT
    COUNT=$(sqlite3 "$SQLITE_PATH" "SELECT COUNT(*) FROM ${TABLE};" 2>/dev/null || echo "0")
    if [ "$COUNT" -eq 0 ]; then
        warn "  ${TABLE}: leer, übersprungen."
        return
    fi

    # SQLite → CSV exportieren (mit Header)
    local CSV_FILE="${TMP_DIR}/${TABLE}.csv"
    sqlite3 -csv -header "$SQLITE_PATH" "SELECT * FROM ${TABLE};" > "$CSV_FILE"

    # CSV → MySQL importieren via Node.js-Skript (sicherer als LOAD DATA)
    node - <<NODEJS
const fs    = require('fs');
const mysql = require('mysql2/promise');

async function run() {
    const conn = await mysql.createConnection({
        host:     '${DB_HOST}',
        port:     ${DB_PORT},
        user:     '${DB_USER}',
        password: '${DB_PASS}',
        database: '${DB_NAME}',
        charset:  'utf8mb4',
        $([ "$USE_SSL" = "j" ] && echo "ssl: { rejectUnauthorized: false }," || echo "")
    });

    const lines  = fs.readFileSync('${CSV_FILE}', 'utf8').trim().split('\n');
    const header = parseCSVLine(lines[0]);
    const rows   = lines.slice(1).map(parseCSVLine);

    let inserted = 0, skipped = 0;
    for (const row of rows) {
        const obj = {};
        header.forEach((h, i) => { obj[h] = row[i] === '' ? null : row[i]; });
        try {
            const cols = header.map(h => \`\\\`\${h}\\\`\`).join(', ');
            const vals = header.map(() => '?').join(', ');
            await conn.execute(\`INSERT IGNORE INTO \\\`${TABLE}\\\` (\${cols}) VALUES (\${vals})\`, header.map(h => obj[h]));
            inserted++;
        } catch(e) {
            process.stderr.write('  Zeile übersprungen: ' + e.message.substring(0,80) + '\n');
            skipped++;
        }
    }
    console.log('  ${TABLE}: ' + inserted + ' eingefügt, ' + skipped + ' übersprungen.');
    await conn.end();
}

function parseCSVLine(line) {
    const result = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"' && inQ && line[i+1] === '"') { cur += '"'; i++; }
        else if (c === '"') { inQ = !inQ; }
        else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
        else { cur += c; }
    }
    result.push(cur);
    return result;
}

run().catch(e => { console.error(e.message); process.exit(1); });
NODEJS

    success "  ${TABLE}: ${COUNT} Zeilen verarbeitet."
}

# mysql2 verfügbar?
if ! node -e "require('mysql2')" &>/dev/null; then
    warn "mysql2 nicht gefunden – wird jetzt installiert..."
    (cd "$SCRIPT_DIR" && npm install mysql2 --silent)
    success "mysql2 installiert."
fi

for TABLE in "${TABLES[@]}"; do
    migrate_table "$TABLE"
done

# =============================================================================
# SCHRITT 8: .env Datei aktualisieren
# =============================================================================
step ".env Datei aktualisieren"

ENV_FILE="${SCRIPT_DIR}/.env"

if [ ! -f "$ENV_FILE" ]; then
    warn ".env nicht gefunden – wird aus .env.example erstellt."
    cp "${SCRIPT_DIR}/.env.example" "$ENV_FILE"
fi

# Hilfsfunktion: ENV-Variable setzen oder hinzufügen
set_env() {
    local KEY="$1" VAL="$2"
    if grep -q "^${KEY}=" "$ENV_FILE"; then
        sed -i "s|^${KEY}=.*|${KEY}=${VAL}|" "$ENV_FILE"
    else
        echo "${KEY}=${VAL}" >> "$ENV_FILE"
    fi
}

set_env "DB_TYPE"  "mysql"
set_env "DB_HOST"  "$DB_HOST"
set_env "DB_PORT"  "$DB_PORT"
set_env "DB_NAME"  "$DB_NAME"
set_env "DB_USER"  "$DB_USER"
set_env "DB_PASS"  "$DB_PASS"
[ "$USE_SSL" = "j" ] && set_env "DB_SSL" "true" || set_env "DB_SSL" "false"

success ".env aktualisiert: DB_TYPE=mysql"

# =============================================================================
# SCHRITT 9: Zusammenfassung
# =============================================================================
step "Migration abgeschlossen"

echo ""
echo -e "${GREEN}${BOLD}Alle Daten wurden erfolgreich nach MySQL migriert!${NC}"
echo ""
echo -e "${BOLD}Nächste Schritte:${NC}"
echo -e "  1. Starte den Tafeline CMS Server neu: pm2 restart tafeline-cms (oder: npm start${NC} (oder: ${CYAN}npm start${NC})"
echo -e "  2. Prüfe ob alles funktioniert (Admin-Panel, Menü, Reservierungen)"
echo -e "  3. Wenn alles OK: SQLite-Backup kannst du später löschen: ${YELLOW}${BACKUP_PATH}${NC}"
echo ""
echo -e "${BOLD}Verbindung:${NC} ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo ""
