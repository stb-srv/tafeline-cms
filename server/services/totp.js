const { generateSecret, generateURI, verifySync } = require('otplib');
const QRCode = require('qrcode');

const ISSUER = 'Tafeline CMS';

const newSecret = () => generateSecret();

/** Prüft einen 6-stelligen Code; jede Fehleingabe (auch kaputte Secrets) ergibt false. */
function verifyCode(code, secret) {
    try {
        return verifySync({ token: String(code ?? '').trim(), secret }).valid === true;
    } catch {
        return false;
    }
}

async function qrDataUrl(user, secret) {
    return QRCode.toDataURL(generateURI({ issuer: ISSUER, label: user, secret }));
}

module.exports = { newSecret, verifyCode, qrDataUrl };
