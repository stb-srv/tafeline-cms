/**
 * Routes – Menü-Export/-Import (JSON-Backup, PDF, Übersetzungen)
 */
const fs = require('fs');
const path = require('path');
const DB = require('../db');
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
const PDFDocument = require('pdfkit');
const { getCurrentLicense } = require('../services/license.js');
const { extractDomain } = require('../helpers.js');
const logger = require('../core/logger.js');
const validate = require('../validation/validate.js');
const { anyObjectSchema } = require('../validation/schemas.js');
const { requireRole } = require('../core/middleware.js');

const BACKUP_VERSION = 1;

/**
 * Formatiert einen Preis robust für die PDF-Ausgabe.
 * Akzeptiert Zahl oder String, fällt bei Unparsbarem auf den Rohwert zurück.
 */
function formatPrice(price) {
    if (price === null || typeof price === 'undefined' || price === '') return '';
    const num = typeof price === 'number' ? price : parseFloat(String(price).replace(',', '.'));
    return Number.isFinite(num) ? `${num.toFixed(2)} €` : String(price);
}

async function getMaxDishes(DB, domain) {
    try {
        const lic = await getCurrentLicense(DB, domain);
        if (!lic.isExpired && lic.limits?.max_dishes) return lic.limits.max_dishes;
    } catch (_) {}
    return 30; // FREE-Plan Default
}

module.exports = (router, { requireAuth }) => {
    // --- Export (Backup als JSON) ---
    router.get('/menu/export', requireAuth, requireRole('admin'), async (req, res) => {
        try {
            const [menu, categories, allergens, additives] = await Promise.all([
                DB.getMenu(),
                DB.getCategories(),
                DB.getKV('allergens', {}),
                DB.getKV('additives', {}),
            ]);

            const backup = {
                _meta: {
                    version: BACKUP_VERSION,
                    createdAt: new Date().toISOString(),
                    generator: 'Tafeline CMS',
                    recordCount: {
                        menu: Array.isArray(menu) ? menu.length : 0,
                        categories: Array.isArray(categories) ? categories.length : 0,
                    },
                },
                menu: Array.isArray(menu) ? menu : [],
                categories: Array.isArray(categories) ? categories : [],
                allergens: allergens && typeof allergens === 'object' ? allergens : {},
                additives: additives && typeof additives === 'object' ? additives : {},
            };

            // Bilder als Base64 einbetten (optional via ?images=true oder immer)
            const imageData = {};
            for (const dish of backup.menu) {
                if (dish.image && dish.image.startsWith('/uploads/')) {
                    const fp = path.join(UPLOADS_DIR, path.basename(dish.image));
                    if (fs.existsSync(fp)) {
                        const ext = path.extname(fp).slice(1) || 'jpeg';
                        imageData[dish.image] =
                            `data:image/${ext};base64,${fs.readFileSync(fp).toString('base64')}`;
                    }
                }
            }
            if (Object.keys(imageData).length > 0) backup._images = imageData;

            const filename = `speisekarte-backup-${new Date().toISOString().slice(0, 10)}.json`;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(JSON.stringify(backup, null, 2));
        } catch (e) {
            logger.error({ err: e }, 'GET /menu/export Fehler');
            res.status(500).json({ success: false, reason: 'Interner Serverfehler.' });
        }
    });

    // --- Export (Speisekarte als PDF) ---
    router.get('/menu/export-pdf', requireAuth, requireRole('admin'), async (req, res) => {
        try {
            const [menu, categories, branding] = await Promise.all([
                DB.getMenu(),
                DB.getCategories(),
                DB.getKV('branding', {}),
            ]);

            const safeMenu = Array.isArray(menu) ? menu : [];
            const safeCats = Array.isArray(categories) ? categories : [];
            const restaurantName =
                branding && branding.name ? String(branding.name) : 'Speisekarte';

            // Kategorien nach sort_order sortieren; Gerichte ihrer cat-Bezeichnung zuordnen
            const sortedCats = [...safeCats].sort(
                (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
            );
            const catLabels = sortedCats.map((c) => (c.label || '').trim()).filter(Boolean);

            const groups = new Map();
            catLabels.forEach((label) => groups.set(label, []));
            const OTHER = 'Weitere';
            for (const item of safeMenu) {
                const cat = (item.cat || '').trim();
                const key = cat && groups.has(cat) ? cat : cat || OTHER;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(item);
            }

            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="Speisekarte.pdf"');
            doc.pipe(res);

            // Kopf
            doc.fontSize(24).font('Helvetica-Bold').text(restaurantName, { align: 'center' });
            doc.moveDown(0.3);
            doc.fontSize(12)
                .font('Helvetica')
                .fillColor('#666')
                .text('Speisekarte', { align: 'center' });
            doc.fillColor('#000').moveDown(1.5);

            let printedAny = false;
            for (const [label, items] of groups) {
                if (!items.length) continue;
                printedAny = true;

                if (doc.y > 720) doc.addPage();
                // Kategorie-Überschrift
                doc.moveDown(0.5);
                doc.fontSize(15).font('Helvetica-Bold').fillColor('#dc2626').text(label);
                doc.moveTo(doc.x, doc.y + 2)
                    .lineTo(545, doc.y + 2)
                    .strokeColor('#dc2626')
                    .stroke();
                doc.fillColor('#000').moveDown(0.6);

                for (const item of items) {
                    if (doc.y > 760) doc.addPage();
                    const startY = doc.y;
                    const numberPrefix = item.number ? `${item.number}. ` : '';
                    const name = `${numberPrefix}${item.name || ''}`.trim();
                    const price = formatPrice(item.price);

                    // Name links, Preis rechts auf gleicher Höhe
                    doc.fontSize(11)
                        .font('Helvetica-Bold')
                        .text(name, 50, startY, { width: 410, continued: false });
                    if (price) {
                        doc.fontSize(11)
                            .font('Helvetica-Bold')
                            .text(price, 460, startY, { width: 85, align: 'right' });
                    }

                    if (item.desc) {
                        doc.fontSize(9.5)
                            .font('Helvetica')
                            .fillColor('#555')
                            .text(String(item.desc), 50, doc.y + 1, { width: 410 });
                        doc.fillColor('#000');
                    }
                    doc.moveDown(0.6);
                }
            }

            if (!printedAny) {
                doc.fontSize(12)
                    .font('Helvetica')
                    .fillColor('#999')
                    .text('Keine Gerichte vorhanden.', { align: 'center' });
            }

            doc.end();
        } catch (e) {
            logger.error({ err: e }, 'GET /menu/export-pdf Fehler');
            if (!res.headersSent) {
                res.status(500).json({ success: false, reason: 'PDF-Erstellung fehlgeschlagen.' });
            } else {
                res.end();
            }
        }
    });

    // --- Import ---
    router.post(
        '/menu/import',
        requireAuth,
        requireRole('admin'),
        validate(anyObjectSchema),
        async (req, res) => {
            try {
                if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
                    return res
                        .status(400)
                        .json({ success: false, reason: 'Ungültiges Backup-Format.' });
                }
                const { menu, categories, allergens, additives } = req.body;
                const domain = extractDomain(req);
                const maxDishes = await getMaxDishes(DB, domain);

                if (menu && Array.isArray(menu) && menu.length > maxDishes) {
                    return res.status(403).json({
                        success: false,
                        reason: `Ihr Plan erlaubt maximal ${maxDishes} Speisen. Die Backup-Datei enthält ${menu.length} Einträge.`,
                        limit: maxDishes,
                        current: menu.length,
                    });
                }
                // Bilder aus Base64-Block wiederherstellen
                if (req.body._images && typeof req.body._images === 'object') {
                    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
                    for (const [urlPath, dataUrl] of Object.entries(req.body._images)) {
                        if (typeof dataUrl !== 'string') continue;
                        const [, b64] = dataUrl.split(',');
                        if (b64) {
                            const filename = path.basename(urlPath);
                            // Nur erlaubte Dateinamen (alphanumeric, -, _, .)
                            if (/^[\w.-]+$/.test(filename)) {
                                fs.writeFileSync(
                                    path.join(UPLOADS_DIR, filename),
                                    Buffer.from(b64, 'base64')
                                );
                            }
                        }
                    }
                }
                if (menu && Array.isArray(menu)) await DB.saveMenu(menu);
                if (categories && Array.isArray(categories)) await DB.saveCategories(categories);
                if (allergens && typeof allergens === 'object')
                    await DB.setKV('allergens', allergens);
                if (additives && typeof additives === 'object')
                    await DB.setKV('additives', additives);
                res.json({ success: true });
            } catch (e) {
                logger.error({ err: e }, '[menu/import] Fehler');
                res.status(500).json({ success: false, reason: 'Interner Serverfehler.' });
            }
        }
    );

    router.get('/menu/export-translations', requireAuth, requireRole('admin'), async (req, res) => {
        try {
            const menu = await DB.getMenu();
            const cats = await DB.getCategories();

            const exportData = {
                categories: cats.map((c) => ({
                    label: c.label,
                    translations: c.translations || {},
                })),
                dishes: menu.map((item) => ({
                    name: item.name,
                    desc: item.desc || '',
                    translations: item.translations || {},
                })),
            };

            res.attachment('translations-export.json');
            res.send(exportData);
        } catch (e) {
            logger.error({ err: e }, 'GET /menu/export-translations Fehler');
            res.status(500).json({ success: false, reason: 'Interner Serverfehler.' });
        }
    });

    router.post(
        '/menu/import-translations',
        requireAuth,
        requireRole('admin'),
        validate(anyObjectSchema),
        async (req, res) => {
            try {
                const importData = req.body;
                let categories = [];
                let dishes = [];

                if (Array.isArray(importData)) {
                    dishes = importData;
                } else if (importData && typeof importData === 'object') {
                    categories = importData.categories || [];
                    dishes = importData.dishes || [];
                } else {
                    return res.status(400).json({ success: false, reason: 'Ungültiges Format.' });
                }

                const currentMenu = await DB.getMenu();
                const currentCats = await DB.getCategories();

                let updatedDishes = 0;
                let updatedCats = 0;
                let skipped = 0;
                const notFound = [];

                for (const entry of categories) {
                    if (!entry.label) continue;
                    const match = currentCats.find(
                        (c) => c.label.trim().toLowerCase() === entry.label.trim().toLowerCase()
                    );
                    if (match) {
                        const merged = {
                            ...(match.translations || {}),
                            ...(entry.translations || {}),
                        };
                        await DB.updateCategory(match.id, { translations: merged });
                        updatedCats++;
                    }
                }

                for (const entry of dishes) {
                    if (!entry.name) {
                        skipped++;
                        continue;
                    }

                    const match = currentMenu.find(
                        (m) => m.name.trim().toLowerCase() === entry.name.trim().toLowerCase()
                    );
                    if (match) {
                        const merged = {
                            ...(match.translations || {}),
                            ...(entry.translations || {}),
                        };
                        await DB.updateMenu(match.id, { translations: merged });
                        updatedDishes++;
                    } else {
                        notFound.push(entry.name);
                    }
                }

                res.json({
                    success: true,
                    updated: updatedDishes,
                    updated_categories: updatedCats,
                    skipped,
                    not_found: notFound,
                });
            } catch (e) {
                logger.error({ err: e }, 'POST /menu/import-translations Fehler');
                res.status(500).json({ success: false, reason: 'Interner Serverfehler.' });
            }
        }
    );
};
