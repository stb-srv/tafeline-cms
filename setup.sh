#!/usr/bin/env bash
# =============================================================================
#  Tafeline CMS – setup.sh (Erstinstallation)
#
#  Richtet einen frischen Ubuntu-/Debian-Server komplett ein: Systempakete,
#  Node.js, App-User, Code, Secrets (.env), Frontend-Build, systemd-Service,
#  nginx und optional HTTPS (Let's Encrypt). Mehrfaches Ausführen ist
#  gefahrlos – vorhandene .env und Datenbank bleiben unangetastet.
#
#  Aufruf (als root oder mit sudo):
#    sudo bash setup.sh                       # interaktiv
#    sudo bash setup.sh --yes --domain restaurant.example.de --email me@example.de
#
#  Optionen:
#    --domain <host>   Domain oder IP des Servers (Standard: localhost)
#    --port <port>     Port des Node-Servers (Standard: 5000)
#    --email <adresse> Let's-Encrypt-Mail; aktiviert HTTPS (nur bei echter Domain)
#    --no-nginx        Kein nginx einrichten (Server lauscht dann direkt auf --port)
#    --dir <pfad>      Installationsverzeichnis (Standard: /opt/tafeline-cms)
#    --branch <name>   Git-Branch (Standard: main)
#    -y, --yes         Keine Rückfragen, Standardwerte übernehmen
#    -h, --help        Diese Hilfe
# =============================================================================
set -Eeuo pipefail

# ── Projektspezifische Werte ─────────────────────────────────────────────────
APP_TITLE="Tafeline CMS"
SERVICE="tafeline-cms"
REPO_URL="https://github.com/stb-srv/tafeline-cms.git"
DEFAULT_DIR="/opt/tafeline-cms"
DEFAULT_PORT="5000"
HEALTH_PATH="/api/setup/status"   # /api/health liefert vor der Ersteinrichtung 403
NODE_MAJOR="22"
MAX_BODY="20M"

# ── Ausgabe-Helfer ───────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC}  $*"; }
info() { echo -e "${CYAN}ℹ${NC}  $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
err()  { echo -e "${RED}✗${NC}  $*" >&2; }
step() { echo -e "\n${BOLD}${CYAN}▶ $*${NC}"; }
trap 'err "Abbruch in Zeile $LINENO (Befehl: $BASH_COMMAND)"' ERR

usage() { awk 'NR>1 && /^#/ { sub(/^# ?/, ""); print; next } NR>1 { exit }' "$0"; }

# ── Argumente ────────────────────────────────────────────────────────────────
DOMAIN=""; PORT=""; LE_EMAIL=""; WITH_NGINX="yes"; APP_DIR=""; BRANCH="main"; ASSUME_YES="no"
while [[ $# -gt 0 ]]; do
    case "$1" in
        --domain)   DOMAIN="${2:?--domain braucht einen Wert}"; shift 2 ;;
        --port)     PORT="${2:?--port braucht einen Wert}"; shift 2 ;;
        --email)    LE_EMAIL="${2:?--email braucht einen Wert}"; shift 2 ;;
        --no-nginx) WITH_NGINX="no"; shift ;;
        --dir)      APP_DIR="${2:?--dir braucht einen Wert}"; shift 2 ;;
        --branch)   BRANCH="${2:?--branch braucht einen Wert}"; shift 2 ;;
        -y|--yes)   ASSUME_YES="yes"; shift ;;
        -h|--help)  usage; exit 0 ;;
        *) err "Unbekannte Option: $1 (siehe --help)"; exit 2 ;;
    esac
done

# ── Root & Betriebssystem ────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    command -v sudo >/dev/null || { err "Bitte als root oder mit sudo ausführen."; exit 1; }
    info "Starte neu mit sudo …"
    exec sudo -E bash "$0" "$@"
fi
command -v apt-get >/dev/null || { err "Nur Ubuntu/Debian (apt) wird unterstützt."; exit 1; }
export DEBIAN_FRONTEND=noninteractive

INTERACTIVE="no"
[[ "$ASSUME_YES" == "no" && -t 0 ]] && INTERACTIVE="yes"

ask() { # ask <Frage> <Standard> -> Antwort (Standard bei Enter oder nicht-interaktiv)
    local answer=""
    if [[ "$INTERACTIVE" == "yes" ]]; then
        read -r -p "?  $1 [$2]: " answer || true
    fi
    echo "${answer:-$2}"
}

get_env() { # get_env <Datei> <Schlüssel>
    [[ -f "$1" ]] && grep -E "^$2=" "$1" | head -n1 | cut -d= -f2- || true
}

set_env() { # set_env <Datei> <Schlüssel> <Wert>  (Wert ohne Zeilenumbrüche)
    local file="$1" key="$2" value="$3" escaped
    escaped=$(printf '%s' "$value" | sed -e 's/[\\&|]/\\&/g')
    if grep -qE "^${key}=" "$file"; then
        sed -i "s|^${key}=.*|${key}=${escaped}|" "$file"
    else
        printf '%s=%s\n' "$key" "$value" >> "$file"
    fi
}

# ── Konfiguration ────────────────────────────────────────────────────────────
APP_DIR="${APP_DIR:-$DEFAULT_DIR}"
APP_USER="$SERVICE"
APP_HOME="/var/lib/$SERVICE"
ENV_FILE="$APP_DIR/.env"

existing_domain=""
if [[ -f "$ENV_FILE" ]]; then
    existing_domain=$(get_env "$ENV_FILE" HOST)
    [[ -z "$PORT" ]] && PORT=$(get_env "$ENV_FILE" PORT)
fi
[[ -z "$DOMAIN" ]] && DOMAIN=$(ask "Domain oder IP des Servers" "${existing_domain:-localhost}")
[[ -z "$PORT" ]] && PORT=$(ask "Port des Node-Servers" "$DEFAULT_PORT")

[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]] || { err "Ungültige Domain/IP: $DOMAIN"; exit 1; }
[[ "$PORT" =~ ^[0-9]+$ && "$PORT" -ge 1 && "$PORT" -le 65535 ]] || { err "Ungültiger Port: $PORT"; exit 1; }
[[ "$BRANCH" =~ ^[A-Za-z0-9._/-]+$ ]] || { err "Ungültiger Branch: $BRANCH"; exit 1; }

IS_REAL_DOMAIN="no"
if [[ "$DOMAIN" == *.* && ! "$DOMAIN" =~ ^[0-9.]+$ ]]; then IS_REAL_DOMAIN="yes"; fi

WITH_SSL="no"
if [[ "$WITH_NGINX" == "yes" && "$IS_REAL_DOMAIN" == "yes" ]]; then
    if [[ -z "$LE_EMAIL" && "$INTERACTIVE" == "yes" ]]; then
        LE_EMAIL=$(ask "E-Mail für Let's Encrypt (leer = kein HTTPS)" "")
    fi
    [[ -n "$LE_EMAIL" ]] && WITH_SSL="yes"
elif [[ -n "$LE_EMAIL" ]]; then
    warn "HTTPS wird übersprungen (benötigt nginx und eine echte Domain, keine IP/localhost)."
    LE_EMAIL=""
fi
if [[ "$WITH_SSL" == "yes" && ! "$LE_EMAIL" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
    err "Ungültige E-Mail-Adresse: $LE_EMAIL"; exit 1
fi

echo -e "\n${BOLD}${CYAN}$APP_TITLE – Setup${NC}"
echo "  Verzeichnis : $APP_DIR"
echo "  Service     : $SERVICE (User: $APP_USER)"
echo "  Domain      : $DOMAIN   Port: $PORT"
echo "  nginx       : $WITH_NGINX   HTTPS: $WITH_SSL   Branch: $BRANCH"

# ── 1. Systempakete ──────────────────────────────────────────────────────────
step "1/9  Systempakete"
apt-get update -qq
apt-get install -y -qq ca-certificates curl git openssl build-essential python3 >/dev/null
[[ "$WITH_NGINX" == "yes" ]] && apt-get install -y -qq nginx >/dev/null
[[ "$WITH_SSL" == "yes" ]] && apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
ok "Pakete installiert"

# ── 2. Node.js ───────────────────────────────────────────────────────────────
step "2/9  Node.js ${NODE_MAJOR}"
current_major=0
command -v node >/dev/null && current_major=$(node -p 'process.versions.node.split(".")[0]')
if [[ "$current_major" -lt "$NODE_MAJOR" ]]; then
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null
    apt-get install -y -qq nodejs >/dev/null
fi
ok "Node.js $(node -v), npm $(npm -v)"

# npm löst github:-Abhängigkeiten (@tafeline/plans) im Lockfile als ssh:// auf –
# auf einem frischen Server gibt es keinen SSH-Key, daher per HTTPS umleiten.
git config --system --unset-all url."https://github.com/".insteadOf 2>/dev/null || true
git config --system --add url."https://github.com/".insteadOf "ssh://git@github.com/"
git config --system --add url."https://github.com/".insteadOf "git@github.com:"

# ── 3. App-User ──────────────────────────────────────────────────────────────
step "3/9  Service-User '$APP_USER'"
if ! id "$APP_USER" &>/dev/null; then
    useradd --system --home-dir "$APP_HOME" --create-home --shell /usr/sbin/nologin "$APP_USER"
    ok "User angelegt"
else
    ok "User existiert bereits"
fi
as_app() { (cd "$APP_DIR" && runuser -u "$APP_USER" -- env HOME="$APP_HOME" "$@"); }

# ── 4. Code ──────────────────────────────────────────────────────────────────
step "4/9  Code nach $APP_DIR"
if [[ -d "$APP_DIR/.git" ]]; then
    chown -R "$APP_USER:$APP_USER" "$APP_DIR"
    as_app git fetch --quiet origin "$BRANCH"
    as_app git checkout --quiet --force -B "$BRANCH" "origin/$BRANCH"
    ok "Repository aktualisiert ($(as_app git rev-parse --short HEAD))"
elif [[ -e "$APP_DIR" && -n "$(ls -A "$APP_DIR" 2>/dev/null)" ]]; then
    err "$APP_DIR existiert und ist kein Git-Checkout. Bitte leeren oder --dir nutzen."; exit 1
else
    mkdir -p "$APP_DIR"
    chown "$APP_USER:$APP_USER" "$APP_DIR"
    as_app git clone --quiet --branch "$BRANCH" "$REPO_URL" .
    ok "Repository geklont ($(as_app git rev-parse --short HEAD))"
fi

# ── 5. Konfiguration (.env) ──────────────────────────────────────────────────
step "5/9  Konfiguration (.env, Secrets, Verzeichnisse)"
ENV_EXISTED="no"; [[ -f "$ENV_FILE" ]] && ENV_EXISTED="yes"
SCHEME="http"
URL_BASE="$SCHEME://$DOMAIN"
[[ "$WITH_NGINX" == "no" ]] && URL_BASE="$SCHEME://$DOMAIN:$PORT"
if [[ "$ENV_EXISTED" == "no" ]]; then
    cat > "$ENV_FILE" <<EOF
# Tafeline CMS – Konfiguration (von setup.sh erzeugt am $(date '+%Y-%m-%d %H:%M:%S'))
# Admin-Zugang, Restaurantdaten, SMTP und Lizenz richtest du im Setup-Wizard im Browser ein.

PORT=$PORT
HOST=$DOMAIN
ADMIN_SECRET=$(openssl rand -hex 32)
CORS_ORIGINS=$URL_BASE
LOG_LEVEL=info

# Lizenzserver (Standard: https://licens.stb-srv.de)
# LICENSE_SERVER_URL=

# SMTP kann auch im CMS unter Einstellungen > E-Mail gesetzt werden
# SMTP_HOST=
# SMTP_PORT=465
# SMTP_SECURE=true
# SMTP_USER=
# SMTP_PASS=
# SMTP_FROM=
EOF
else
    set_env "$ENV_FILE" PORT "$PORT"
    # Domain/CORS nur bei geänderter Domain setzen – manuelle Anpassungen bleiben sonst erhalten
    if [[ "$DOMAIN" != "$existing_domain" ]]; then
        set_env "$ENV_FILE" HOST "$DOMAIN"
        set_env "$ENV_FILE" CORS_ORIGINS "$URL_BASE"
    fi
fi
chown "$APP_USER:$APP_USER" "$ENV_FILE"
chmod 600 "$ENV_FILE"
mkdir -p "$APP_DIR/uploads" "$APP_DIR/tmp" "$APP_DIR/backups" "$APP_DIR/server" "$APP_DIR/plugins"
chown -R "$APP_USER:$APP_USER" "$APP_DIR/uploads" "$APP_DIR/tmp" "$APP_DIR/backups" "$APP_DIR/server" "$APP_DIR/plugins"
ok ".env bereit (bestehende Werte bleiben erhalten)"

# ── 6. Abhängigkeiten & Frontend ─────────────────────────────────────────────
step "6/9  Abhängigkeiten installieren & Frontend bauen (dauert ein paar Minuten)"
as_app npm ci --omit=dev --no-audit --no-fund --loglevel=error
as_app npm --prefix web ci --no-audit --no-fund --loglevel=error
as_app npm --prefix web run build --silent
ok "Dependencies installiert, Frontend gebaut"

# ── 7. systemd ───────────────────────────────────────────────────────────────
step "7/9  systemd-Service"
cat > "/etc/systemd/system/${SERVICE}.service" <<EOF
[Unit]
Description=$APP_TITLE
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
ExecStart=$(command -v node) server.js
Restart=always
RestartSec=5
SyslogIdentifier=$SERVICE
LimitNOFILE=65535

# Härtung: Schreibzugriff nur im App-Verzeichnis
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=$APP_DIR

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable "$SERVICE" >/dev/null 2>&1
systemctl restart "$SERVICE"
ok "Service '$SERVICE' gestartet, Autostart aktiv"

# ── 8. nginx, Firewall, HTTPS ────────────────────────────────────────────────
step "8/9  nginx / Firewall / HTTPS"
if [[ "$WITH_NGINX" == "yes" ]]; then
    NGINX_CONF="/etc/nginx/sites-available/$SERVICE"
    server_name="$DOMAIN"; [[ "$DOMAIN" == "localhost" || "$DOMAIN" =~ ^[0-9.]+$ ]] && server_name="_"
    # WebSocket-Upgrade nur bei Bedarf (socket.io), sonst normale Verbindung
    cat > "/etc/nginx/conf.d/${SERVICE}-upgrade.conf" <<EOF
map \$http_upgrade \$tafeline_cms_connection {
    default upgrade;
    ''      close;
}
EOF
    if [[ -f "$NGINX_CONF" ]] && grep -q "ssl_certificate" "$NGINX_CONF"; then
        info "nginx-Konfiguration wird von certbot verwaltet – bleibt unverändert"
    else
        cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name $server_name;
    client_max_body_size $MAX_BODY;

    location / {
        proxy_pass         http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection \$tafeline_cms_connection;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
}
EOF
    fi
    ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/$SERVICE"
    rm -f /etc/nginx/sites-enabled/default
    nginx -t >/dev/null 2>&1 || { nginx -t; err "nginx-Konfiguration fehlerhaft"; exit 1; }
    systemctl enable nginx >/dev/null 2>&1
    systemctl reload nginx 2>/dev/null || systemctl restart nginx
    ok "nginx leitet $server_name auf Port $PORT"
fi

if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
    if [[ "$WITH_NGINX" == "yes" ]]; then ufw allow 'Nginx Full' >/dev/null; else ufw allow "$PORT/tcp" >/dev/null; fi
    ok "Firewall (ufw) angepasst"
fi

if [[ "$WITH_SSL" == "yes" ]]; then
    if certbot --nginx --non-interactive --agree-tos --redirect -m "$LE_EMAIL" -d "$DOMAIN"; then
        set_env "$ENV_FILE" CORS_ORIGINS "https://$DOMAIN"
        SCHEME="https"
        systemctl restart "$SERVICE"
        ok "HTTPS aktiv (Zertifikat erneuert sich automatisch)"
    else
        warn "certbot fehlgeschlagen (zeigt die Domain schon auf diesen Server?)."
        warn "Später nachholen: sudo bash setup.sh --domain $DOMAIN --email $LE_EMAIL"
    fi
fi

# ── 9. Prüfung ───────────────────────────────────────────────────────────────
step "9/9  Funktionstest"
healthy="no"
for _ in $(seq 1 30); do
    if curl -fs -o /dev/null "http://127.0.0.1:$PORT$HEALTH_PATH"; then healthy="yes"; break; fi
    sleep 2
done
if [[ "$healthy" != "yes" ]]; then
    err "Server antwortet nicht. Letzte Logzeilen:"
    journalctl -u "$SERVICE" -n 30 --no-pager || true
    exit 1
fi
ok "Server läuft und antwortet auf $HEALTH_PATH"
as_app git rev-parse HEAD > "$APP_DIR/.deployed-commit"; chown "$APP_USER:$APP_USER" "$APP_DIR/.deployed-commit"

FINAL_URL="$SCHEME://$DOMAIN"
[[ "$WITH_NGINX" == "no" ]] && FINAL_URL="$SCHEME://$DOMAIN:$PORT"
SETUP_TOKEN=""
if [[ ! -f "$APP_DIR/server/config.json" ]]; then
    for _ in $(seq 1 10); do
        SETUP_TOKEN=$(journalctl -u "$SERVICE" -n 200 --no-pager -o cat 2>/dev/null | grep -oE 'Token:[[:space:]]+[0-9a-f]+' | tail -n1 | awk '{print $2}' || true)
        [[ -n "$SETUP_TOKEN" ]] && break
        sleep 1
    done
fi

echo -e "\n${BOLD}${GREEN}✅ $APP_TITLE ist installiert.${NC}\n"
if [[ -f "$APP_DIR/server/config.json" ]]; then
    echo -e "  Die Ersteinrichtung ist bereits abgeschlossen – Admin-Panel: ${BOLD}$FINAL_URL/admin${NC}\n"
else
    echo -e "  ${BOLD}Nächster Schritt:${NC} Setup-Wizard im Browser abschließen"
    echo -e "    ${BOLD}$FINAL_URL/setup${NC}"
    if [[ -n "$SETUP_TOKEN" ]]; then
        echo -e "    Setup-Token: ${BOLD}$SETUP_TOKEN${NC}  (gilt bis zum nächsten Neustart des Services)"
    else
        echo "    Setup-Token:  journalctl -u $SERVICE | grep Token"
    fi
    echo ""
fi
echo "  Logs:      journalctl -fu $SERVICE"
echo "  Status:    systemctl status $SERVICE"
echo "  Updates:   sudo bash $APP_DIR/deploy.sh"
echo "  Secrets:   $ENV_FILE  (Backup aufbewahren!)"
echo ""
