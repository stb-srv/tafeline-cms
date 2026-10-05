#!/bin/bash
echo "=============================================================="
echo " Tafeline CMS - Automatisches Update-Skript (Mac / Linux)"
echo "=============================================================="
echo ""

# --- Änderungen von GitHub holen ---
echo "[1/3] Ziehe aktuelle Änderungen von GitHub..."
git pull
if [ $? -ne 0 ]; then
    echo ""
    echo "[FEHLER] git pull fehlgeschlagen."
    echo "  Mögliche Ursachen:"
    echo "    - Lokale Änderungen vorhanden (git stash oder git reset --hard HEAD)"
    echo "    - Falscher Branch (git branch zeigt aktuellen Branch)"
    echo "    - Keine Internetverbindung"
    exit 1
fi

# --- Dependencies aktualisieren ---
echo ""
echo "[2/3] Installiere/aktualisiere Abhängigkeiten..."
npm install --silent
if [ $? -ne 0 ]; then
    echo "[FEHLER] npm install fehlgeschlagen."
    exit 1
fi

# --- Server neu starten (PM2 oder systemd automatisch erkennen) ---
echo ""
echo "[3/3] Server neu starten..."

if command -v pm2 &>/dev/null && pm2 list 2>/dev/null | grep -q 'opa-cms'; then
    pm2 restart opa-cms
    echo "[OK] PM2: opa-cms neu gestartet."
elif systemctl is-active --quiet meraki-cms 2>/dev/null; then
    sudo systemctl restart meraki-cms
    echo "[OK] systemd: meraki-cms neu gestartet."
elif command -v pm2 &>/dev/null; then
    echo "[INFO] PM2 verfügbar, aber kein 'opa-cms' Prozess gefunden."
    echo "       Starte mit: pm2 start server.js --name opa-cms"
else
    echo "[INFO] Kein laufender Server erkannt."
    echo "       Starte manuell mit: npm start"
    echo "       Oder lokal mit:     ./start-mac-linux.sh"
fi

echo ""
echo "=============================================================="
echo " Update abgeschlossen! Tafeline CMS läuft auf dem neuesten Stand."
echo "=============================================================="
