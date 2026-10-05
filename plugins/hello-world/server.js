/**
 * Tafeline Extra Plugin - Server Side
 */
module.exports = (app, core) => {
    // core contains: { readDB, writeDB, requireAuth, requireLicense }

    app.get('/api/v1/hello', (req, res) => {
        res.json({ message: 'Hallo vom Tafeline Extra Plugin Server!' });
    });

    console.log("🚀 Plugin Server Route '/api/v1/hello' registriert!");
};
