/**
 * Menü-Hilfsfunktionen (Kategorie-Normalisierung, Auto-Anlage)
 */
const DB = require('../db');
const logger = require('../core/logger.js');

function normalizeCatId(cat) {
    if (!cat) return '';
    return String(cat)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_');
}

/**
 * Prüft ob ein Gericht (über sein `cat`-Feld) zu einer Kategorie gehört –
 * per ID, normalisierter ID oder Label, analog zur Frontend-Logik (dishInCat/catMatchesFilter).
 */
function dishMatchesCategory(dishCat, catId, catLabel) {
    if (!dishCat) return false;
    const d = String(dishCat).trim();
    if (!d) return false;
    if (d === catId) return true;
    if (normalizeCatId(d) === catId) return true;
    if (catLabel && d.toLowerCase() === catLabel.trim().toLowerCase()) return true;
    return false;
}

/**
 * Stellt sicher dass eine Kategorie (label-String) in der categories-Tabelle existiert.
 * Falls nicht, wird sie automatisch angelegt.
 */
async function ensureCategoryExists(catLabel) {
    if (!catLabel || typeof catLabel !== 'string') return;
    const label = catLabel.trim();
    if (!label) return;
    try {
        const existing = await DB.getCategories();
        const alreadyExists =
            Array.isArray(existing) &&
            existing.some(
                (c) =>
                    c.id === label ||
                    normalizeCatId(label) === c.id ||
                    (c.label || '').trim().toLowerCase() === label.toLowerCase()
            );
        if (!alreadyExists) {
            const id =
                label
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, '_')
                    .replace(/_+/g, '_') || Date.now().toString();
            await DB.addCategory({
                id,
                label,
                icon: 'utensils',
                active: true,
                sort_order: existing.length || 0,
            });
            logger.info({ label }, '[categories] Auto-angelegt');
        }
    } catch (e) {
        logger.warn({ err: e }, '[categories] ensureCategoryExists Fehler');
    }
}

module.exports = { normalizeCatId, dishMatchesCategory, ensureCategoryExists };
