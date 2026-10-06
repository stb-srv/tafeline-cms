#!/bin/bash
# ==============================================================================
#  Tafeline CMS - Update & Upgrade Skript
#  Holt die neueste Version von GitHub und startet den Server neu.
#
#  Nutzung:
#    chmod +x update-upgrade.sh
#    ./update-upgrade.sh            (lokal / Mac / Linux)
#    sudo ./update-upgrade.sh       (Produktivserver mit PM2 / systemd)
# ==============================================================================

set -euo pipefail

# --- Farben ---
RED='\033[0;31m';  GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m';  BOLD='\033[1m'; NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[ OK ]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[FAIL]${NC}  $1"; }
log_step()  { echo -e "\n${BOLD}${CYAN}▶ $1${NC}"; }

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${INSTALL_DIR}"

clear
echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║       Tafeline CMS - Update & Upgrade Skript            ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"
log_info "Verzeichnis: ${INSTALL_DIR}"

# --- Git-Status prüfen: lokale Änderungen? ---
log_step "Schritt 1/4: Git-Status prüfen"
if ! git rev-parse --is-inside-work-tree &>/dev/null; then
    log_error "Dieses Verzeichnis ist kein Git-Repository!"
    log_error "Bitte mit 'git clone' installieren oder in das richtige Verzeichnis wechseln."
    exit 1
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
CURRENT_COMMIT=$(git rev-parse --short HEAD)
log_info "Aktueller Branch: ${CURRENT_BRANCH} (${CURRENT_COMMIT})"

# Lokale Änderungen prüfen (nur getrackte Dateien; .env / config.json sind in .gitignore)
if ! git diff --quiet HEAD 2>/dev/null; then
    log_warn "Lokale Änderungen an gettrackten Dateien erkannt."
    log_warn "Diese werden durch 'git pull' ggf. überschrieben."
    read -rp "  Trotzdem fortfahren? [J/n]: " FORCE_UPDATE
    FORCE_UPDATE=${FORCE_UPDATE:-J}
    if [[ "${FORCE_UPDATE,,}" != "j" && "${FORCE_UPDATE,,}" != "y" ]]; then
        log_info "Update abgebrochen."
        exit 0
    fi
fi

# --- Remote-Stand holen & pullen ---
log_step "Schritt 2/4: Neueste Version von GitHub holen"
log_info "Fetche Remote-Stand..."
git fetch origin

REMOTE_COMMIT=$(git rev-parse --short "origin/${CURRENT_BRANCH}" 2>/dev/null || echo "unbekannt")
if [ "${CURRENT_COMMIT}" = "${REMOTE_COMMIT}" ]; then
    log_ok "Bereits auf dem neuesten Stand (${CURRENT_COMMIT})."
    echo
    read -rp "  Trotzdem npm install + Neustart durchführen? [j/N]: " FORCE_REINSTALL
    FORCE_REINSTALL=${FORCE_REINSTALL:-N}
    if [[ "${FORCE_REINSTALL,,}" != "j" && "${FORCE_REINSTALL,,}" != "y" ]]; then
        log_info "Nichts zu tun. Beende."
        exit 0
    fi
else
    log_info "Neue Version verfügbar: ${CURRENT_COMMIT} → ${REMOTE_COMMIT}"
    git pull origin "${CURRENT_BRANCH}"
    log_ok "Code aktualisiert auf ${REMOTE_COMMIT}"
fi

# --- npm install ---
log_step "Schritt 3/4: Abhängigkeiten aktualisieren"
log_info "Führe npm install aus..."
npm install --silent
if [ $? -ne 0 ]; then
    log_error "npm install fehlgeschlagen!"
    log_error "Stelle sicher dass build-essential und python3 installiert sind:"
    log_error "  sudo apt install -y build-essential python3"
    exit 1
fi
log_ok "Abhängigkeiten aktualisiert"

# --- Verzeichnisse sicherstellen (nach Update können neue benötigt werden) ---
mkdir -p "${INSTALL_DIR}/uploads" \
         "${INSTALL_DIR}/tmp" \
         "${INSTALL_DIR}/server" \
         "${INSTALL_DIR}/cms/assets/css" \
         "${INSTALL_DIR}/plugins"

# --- Server neu starten ---
log_step "Schritt 4/4: Server neu starten"

RESTARTED=false

# PM2
if command -v pm2 &>/dev/null && pm2 list 2>/dev/null | grep -q 'tafeline-cms'; then
    pm2 restart tafeline-cms
    log_ok "PM2: tafeline-cms neu gestartet"
    RESTARTED=true
# systemd
elif systemctl is-active --quiet tafeline-cms 2>/dev/null; then
    if [[ $EUID -eq 0 ]]; then
        systemctl restart tafeline-cms
    else
        sudo systemctl restart tafeline-cms
    fi
    log_ok "systemd: tafeline-cms neu gestartet"
    RESTARTED=true
elif command -v pm2 &>/dev/null; then
    log_warn "PM2 verfügbar, aber kein 'tafeline-cms' Prozess aktiv."
    log_warn "Starte neu mit: pm2 start ${INSTALL_DIR}/server.js --name tafeline-cms"
else
    log_warn "Kein laufender Server erkannt (weder PM2 noch systemd)."
    log_warn "Für lokale Entwicklung: ./start-mac-linux.sh"
fi

# --- Datenbank-Migrationen Hinweis ---
echo
log_info "ℹ️  Datenbankmigrationen werden automatisch beim nächsten Start ausgeführt."
log_info "   .env, Datenbank und alle Einstellungen bleiben unangetastet."

# --- Zusammenfassung ---
echo
echo -e "${BOLD}${GREEN}"
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║             ✓ UPDATE ABGESCHLOSSEN                  ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"
if [ "${RESTARTED}" = true ]; then
    echo -e "  ${GREEN}✅ Tafeline CMS läuft auf dem neuesten Stand.${NC}"
else
    echo -e "  ${YELLOW}⚠️  Code aktualisiert, Server muss noch manuell gestartet werden.${NC}"
fi
echo
