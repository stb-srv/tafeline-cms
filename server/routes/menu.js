/**
 * Routes – Menu, Categories, Allergens, Additives, Import
 */
const router = require('express').Router();
const DB = require('../db');
const { getCurrentLicense } = require('../services/license.js');
const { extractDomain } = require('../helpers.js');
const logger = require('../core/logger.js');
const validate = require('../validation/validate.js');
const {
    menuItemSchema,
    menuReorderSchema,
    menuBulkSchema,
    categorySchema,
    anyObjectSchema,
} = require('../validation/schemas.js');
const { requireRole } = require('../core/middleware.js');
const { normalizeCatId, dishMatchesCategory, ensureCategoryExists } = require('./menu-helpers.js');

module.exports = (requireAuth, requireLicense) => {
    // --- Menu ---
    router.get('/menu', async (req, res) => {
        try {
            const result = await DB.getMenu();
            res.json(Array.isArray(result) ? result : []);
        } catch (e) {
            logger.error({ err: e }, 'GET /menu Fehler');
            res.status(500).json({ success: false, reason: 'Interner Serverfehler.' });
        }
    });

    router.post(
        '/menu',
        requireAuth,
        requireRole('admin'),
        requireLicense('menu_edit'),
        validate(menuItemSchema),
        async (req, res) => {
            try {
                const domain = extractDomain(req);
                let lic = null;
                try {
                    lic = await getCurrentLicense(DB, domain);
                } catch (_) {}
                const maxDishes = lic?.limits?.max_dishes ?? 30;
                const menu = await DB.getMenu();
                if (menu.length >= maxDishes)
                    return res.status(403).json({
                        success: false,
                        reason: `Ihr ${lic?.label || lic?.type || 'Free'}-Plan erlaubt maximal ${maxDishes} Speisen.`,
                    });
                const m = req.body;
                if (typeof m.number === 'undefined' && typeof m.nr !== 'undefined') m.number = m.nr;
                if (typeof m.number === 'string') m.number = m.number.trim() || null;
                m.id = m.id || Date.now().toString();
                if (m.cat) await ensureCategoryExists(m.cat);
                await DB.addMenu(m);
                res.json({ success: true, id: m.id });
            } catch (e) {
                logger.error({ err: e }, 'POST /menu Fehler');
                res.status(500).json({ success: false, reason: 'Interner Serverfehler.' });
            }
        }
    );

    router.put(
        '/menu/:id',
        requireAuth,
        requireRole('admin'),
        requireLicense('menu_edit'),
        validate(anyObjectSchema),
        async (req, res) => {
            try {
                const body = req.body;
                if (typeof body.number === 'undefined' && typeof body.nr !== 'undefined')
                    body.number = body.nr;
                if (typeof body.number === 'string') body.number = body.number.trim() || null;
                if (body.cat) await ensureCategoryExists(body.cat);
                body._changed_by = req.admin?.user || req.admin?.name || null;
                const updated = await DB.updateMenu(req.params.id, body);
                if (!updated)
                    return res
                        .status(404)
                        .json({ success: false, reason: 'Gericht nicht gefunden.' });
                try {
                    if (DB.addAuditLog)
                        await DB.addAuditLog({
                            actor: body._changed_by,
                            action: 'menu.update',
                            entity: 'menu',
                            entity_id: req.params.id,
                            detail: { name: updated.name },
                        });
                } catch (_) {}
                res.json({ success: true, item: updated });
            } catch (e) {
                logger.error({ err: e }, 'PUT /menu/:id Fehler');
                res.status(500).json({ success: false, reason: 'Interner Serverfehler.' });
            }
        }
    );

    router.delete(
        '/menu/:id',
        requireAuth,
        requireRole('admin'),
        requireLicense('menu_edit'),
        async (req, res) => {
            try {
                await DB.deleteMenu(req.params.id);
                res.json({ success: true });
            } catch (e) {
                logger.error({ err: e }, 'DELETE /menu/:id Fehler');
                res.status(500).json({ success: false, reason: 'Interner Serverfehler.' });
            }
        }
    );

    router.post(
        '/menu/reorder',
        requireAuth,
        requireRole('admin'),
        validate(menuReorderSchema),
        async (req, res) => {
            try {
                const { ids } = req.body;
                if (!Array.isArray(ids)) return res.status(400).json({ success: false });
                const menu = await DB.getMenu();
                const reordered = ids
                    .map((id) => menu.find((d) => String(d.id) === String(id)))
                    .filter(Boolean);
                menu.forEach((d) => {
                    if (!ids.includes(String(d.id))) reordered.push(d);
                });
                // sort_order frisch nach neuer Position vergeben (sonst behält saveMenu alte Werte)
                reordered.forEach((d, i) => {
                    d.sort_order = i;
                });
                await DB.saveMenu(reordered);
                res.json({ success: true });
            } catch (e) {
                logger.error({ err: e }, 'POST /menu/reorder Fehler');
                res.status(500).json({ success: false, reason: 'Interner Serverfehler.' });
            }
        }
    );

    // Bulk-Aktionen: aktivieren / deaktivieren / löschen / Kategorie setzen
    router.post(
        '/menu/bulk',
        requireAuth,
        requireRole('admin'),
        requireLicense('menu_edit'),
        validate(menuBulkSchema),
        async (req, res) => {
            try {
                const { ids, action, cat } = req.body;
                const actor = req.admin?.user || req.admin?.name || null;
                let affected = 0;
                if (action === 'delete') {
                    affected = await DB.bulkDeleteMenu(ids);
                } else if (action === 'enable') {
                    affected = await DB.bulkUpdateMenu(ids, { available: true });
                } else if (action === 'disable') {
                    affected = await DB.bulkUpdateMenu(ids, { available: false });
                } else if (action === 'set_category') {
                    if (!cat)
                        return res.status(400).json({ success: false, reason: 'Kategorie fehlt.' });
                    await ensureCategoryExists(cat);
                    affected = await DB.bulkUpdateMenu(ids, { cat });
                }
                try {
                    if (DB.addAuditLog)
                        await DB.addAuditLog({
                            actor,
                            action: 'menu.bulk.' + action,
                            entity: 'menu',
                            entity_id: ids.join(','),
                            detail: { count: ids.length, cat },
                        });
                } catch (_) {}
                res.json({ success: true, affected });
            } catch (e) {
                logger.error({ err: e }, 'POST /menu/bulk Fehler');
                res.status(500).json({ success: false, reason: 'Interner Serverfehler.' });
            }
        }
    );

    // Preishistorie eines Gerichts
    router.get('/menu/:id/price-history', requireAuth, requireRole('admin'), async (req, res) => {
        try {
            const history = DB.getMenuPriceHistory
                ? await DB.getMenuPriceHistory(req.params.id)
                : [];
            res.json(Array.isArray(history) ? history : []);
        } catch (e) {
            logger.error({ err: e }, 'GET /menu/:id/price-history Fehler');
            res.status(500).json({ success: false, reason: 'Interner Serverfehler.' });
        }
    });

    // --- Categories ---
    router.get('/categories', async (req, res) => {
        try {
            const dbCats = await DB.getCategories();
            const safeCats = Array.isArray(dbCats) ? dbCats : [];

            const menuItems = await DB.getMenu();
            const menuCatLabels = Array.isArray(menuItems)
                ? [...new Set(menuItems.map((m) => (m.cat || '').trim()).filter(Boolean))]
                : [];

            const existingLabels = new Set(
                safeCats.map((c) => (c.label || '').trim().toLowerCase())
            );

            // READ-ONLY: fehlende Kategorien nur für die Antwort ableiten, NICHT
            // persistieren. Ein GET darf keine Seiteneffekte/DB-Writes auslösen
            // (race-anfällig bei parallelen Gäste-Requests). Die persistente
            // Anlage erfolgt bei Menü-Schreibvorgängen via ensureCategoryExists().
            for (const rawCat of menuCatLabels) {
                const matchesRealCategory = safeCats.some((c) =>
                    dishMatchesCategory(rawCat, c.id, c.label)
                );
                if (matchesRealCategory) continue;
                if (!existingLabels.has(rawCat.toLowerCase())) {
                    const id = normalizeCatId(rawCat) || Date.now().toString();
                    safeCats.push({
                        id,
                        label: rawCat,
                        icon: 'utensils',
                        active: 1,
                        sort_order: safeCats.length,
                    });
                    existingLabels.add(rawCat.toLowerCase());
                }
            }

            res.json(safeCats);
        } catch (e) {
            logger.error({ err: e }, 'GET /categories Fehler');
            res.json([]);
        }
    });

    router.post(
        '/categories',
        requireAuth,
        requireRole('admin'),
        validate(categorySchema),
        async (req, res) => {
            try {
                const c = req.body;
                if (!c.label)
                    return res.status(400).json({ success: false, reason: 'Label erforderlich.' });
                c.id =
                    c.id ||
                    c.label
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, '_')
                        .replace(/_+/g, '_') ||
                    Date.now().toString();
                await DB.addCategory(c);
                res.json({ success: true, id: c.id });
            } catch (e) {
                logger.error({ err: e }, 'POST /categories Fehler');
                res.status(500).json({ success: false, reason: 'Interner Serverfehler.' });
            }
        }
    );

    router.put(
        '/categories/:id',
        requireAuth,
        requireRole('admin'),
        validate(anyObjectSchema),
        async (req, res) => {
            try {
                const updated = await DB.updateCategory(req.params.id, req.body);
                if (!updated)
                    return res
                        .status(404)
                        .json({ success: false, reason: 'Kategorie nicht gefunden.' });
                res.json({ success: true, item: updated });
            } catch (e) {
                logger.error({ err: e }, 'PUT /categories/:id Fehler');
                res.status(500).json({ success: false, reason: 'Interner Serverfehler.' });
            }
        }
    );

    router.delete('/categories/:id', requireAuth, requireRole('admin'), async (req, res) => {
        try {
            const catId = req.params.id;
            const categories = await DB.getCategories();
            const cat = Array.isArray(categories) ? categories.find((c) => c.id === catId) : null;

            // Gerichte, die noch auf die zu löschende Kategorie zeigen (per ID, normalisierter
            // ID oder Label), müssen entkoppelt werden – sonst tauchen sie in GET /categories
            // als abgeleitete "Phantom"-Kategorie wieder auf (siehe dortiger Kommentar).
            const menuItems = await DB.getMenu();
            const affectedIds = Array.isArray(menuItems)
                ? menuItems
                      .filter((m) => dishMatchesCategory(m.cat, catId, cat?.label))
                      .map((m) => m.id)
                : [];
            if (affectedIds.length > 0) {
                await DB.bulkUpdateMenu(affectedIds, { cat: null });
            }

            await DB.deleteCategory(catId);
            res.json({ success: true, unassignedDishes: affectedIds.length });
        } catch (e) {
            logger.error({ err: e }, 'DELETE /categories/:id Fehler');
            res.status(500).json({ success: false, reason: 'Interner Serverfehler.' });
        }
    });

    // --- Allergens / Additives ---
    router.get('/allergens', async (req, res) => {
        try {
            const result = await DB.getKV('allergens', {});
            res.json(result && typeof result === 'object' && !Array.isArray(result) ? result : {});
        } catch (e) {
            res.json({});
        }
    });
    router.post(
        '/allergens',
        requireAuth,
        requireRole('admin'),
        validate(anyObjectSchema),
        async (req, res) => {
            try {
                await DB.setKV('allergens', req.body);
                res.json({ success: true });
            } catch (e) {
                logger.error({ err: e }, 'POST /allergens Fehler');
                res.status(500).json({ success: false, reason: 'Interner Serverfehler.' });
            }
        }
    );
    router.get('/additives', async (req, res) => {
        try {
            const result = await DB.getKV('additives', {});
            res.json(result && typeof result === 'object' && !Array.isArray(result) ? result : {});
        } catch (e) {
            res.json({});
        }
    });
    router.post(
        '/additives',
        requireAuth,
        requireRole('admin'),
        validate(anyObjectSchema),
        async (req, res) => {
            try {
                await DB.setKV('additives', req.body);
                res.json({ success: true });
            } catch (e) {
                logger.error({ err: e }, 'POST /additives Fehler');
                res.status(500).json({ success: false, reason: 'Interner Serverfehler.' });
            }
        }
    );

    require('./menu-transfer.js')(router, { requireAuth });

    return router;
};

// Für Tests
module.exports._internals = { normalizeCatId, dishMatchesCategory };
