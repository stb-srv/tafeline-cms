/**
 * Tafeline CMS Admin Recovery Script
 * Nutzung: node reset-admin.js
 *
 * Setzt das Passwort des ersten Admin-Accounts auf ein zufälliges Passwort zurück.
 * Das neue Passwort wird in der Konsole angezeigt.
 * Beim nächsten Login wird eine Passwortänderung erzwungen.
 */

const DB = require('./server/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

async function resetPassword() {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║       Tafeline CMS - Admin Wiederherstellung      ║');
    console.log('╚══════════════════════════════════════════════╝\n');

    try {
        const users = DB.getUsers();
        const admins = users.filter((u) => u.role === 'admin');

        if (admins.length === 0) {
            console.log('[INFO] Kein Admin-Account gefunden.');
            console.log('[INFO] Erstelle Notfall-Admin-Account...');

            const plainPass = crypto.randomBytes(4).toString('hex'); // z.B. "a3f9b2c1"
            const hashed = await bcrypt.hash(plainPass, 12);

            DB.addUser({
                user: 'admin',
                pass: hashed,
                name: 'Notfall',
                last_name: 'Admin',
                email: '',
                role: 'admin',
                require_password_change: 1,
                recovery_codes: [],
            });

            console.log('\n✅ Notfall-Admin erstellt!');
            console.log('─'.repeat(46));
            console.log(`  Benutzername: admin`);
            console.log(`  Passwort:     ${plainPass}`);
            console.log('─'.repeat(46));
        } else {
            // Ersten Admin zurücksetzen
            const target = admins[0];
            const plainPass = crypto.randomBytes(4).toString('hex');
            const hashed = await bcrypt.hash(plainPass, 12);

            DB.setUserPass(target.user, hashed, true);

            console.log(`✅ Passwort für "${target.user}" zurückgesetzt!`);
            console.log('─'.repeat(46));
            console.log(`  Benutzername: ${target.user}`);
            console.log(`  Passwort:     ${plainPass}`);
            console.log('─'.repeat(46));
        }

        console.log('\n⚠️  Bitte nach dem Login sofort ein neues Passwort setzen.');
        console.log('   Das Passwort wird beim nächsten Login automatisch abgefragt.\n');
    } catch (e) {
        console.error('\n❌ FEHLER: Datenbankzugriff fehlgeschlagen.');
        console.error(e.message);
        process.exit(1);
    }

    process.exit(0);
}

resetPassword();
