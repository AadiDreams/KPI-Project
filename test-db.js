const pool = require('./db');

(async () => {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('Connected to DB:', res.rows[0]);
    } catch (err) {
        console.error('Error connecting to DB:', err);
    } finally {
        pool.end();
    }
})();
