const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
require('dotenv').config();
const { Pool } = require('pg');
// require('crypto').randomBytes(64).toString('hex');


const app = express();

// Database connection setup
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
});

// Middleware for parsing request body
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files
app.use('/css', express.static(path.join(__dirname, 'assets/css')));
app.use('/js', express.static(path.join(__dirname, 'assets/js')));
app.use('/images', express.static(path.join(__dirname, 'assets/images')));

// Setup session
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
}));

// Use EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Login route
app.post('/login', async (req, res) => {
    const { username, password} = req.body;

    if (!username || !password ) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    try {
        const query = `SELECT * FROM users WHERE username = $1`;
        const result = await pool.query(query, [username]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid username' });
        }

        const user = result.rows[0];
        if (password !== user.password) {
            return res.status(401).json({ error: 'Invalid password.' });
        }


        // Save user session
        req.session.user = { id: user.id, username: user.username, role:user.role };
        res.redirect('/security-head/home')
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Logout route
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to log out.' });
        }
        res.json({ message: 'Logged out successfully.' });
    });
});
app.get('/security-head/home', (req, res) => {
    if (!req.session.user || req.session.user.role !== 1) {
        return res.status(403).send('Access denied.');
    }

    const { name } = req.session.user;
    res.render('securityHeadHome', { name, newIncidents: 5, pendingActions: 3, thresholdAlerts: 2, recentUpdates: [] });
});
// Other routes
const securityHeadRoutes = require('./routes/securityHead');
app.use('/security-head', securityHeadRoutes);

// Server Listening
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

app.use(express.static(path.join(__dirname,'public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
  });