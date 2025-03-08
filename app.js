const express = require('express');
const multer = require('multer');
const path = require('path');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const bcrypt = require('bcrypt');
const fs = require('fs');
require('dotenv').config();

const app = express();
const mysql = require('mysql2/promise');
const mariadb = require('mariadb');

const pool = mariadb.createPool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 3307,
    connectionLimit: 10 // Optional: Limits concurrent connections
});
module.exports = pool;

// ✅ Database connection details
const dbOptions = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3307,
    clearExpired: true,         // Remove expired sessions
    expiration: 1000 * 60 * 60, // Session expires in 1 hour
};

const sessionStore = new MySQLStore(dbOptions);

// ✅ Ensure the upload directory exists
const uploadDirectory = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, { recursive: true });
}

// ✅ Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDirectory);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// ✅ Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ✅ Static file serving
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'assets/css')));
app.use('/js', express.static(path.join(__dirname, 'assets/js')));
app.use('/images', express.static(path.join(__dirname, 'assets/images')));

// ✅ Session middleware using MySQLStore (MariaDB)
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: sessionStore, // Store sessions in MariaDB
    cookie: { secure: false, httpOnly: true, maxAge: 1000 * 60 * 60 } // 1-hour session
}));

// ✅ Debugging session data
app.use((req, res, next) => {
    if (!req.path.match(/\.(css|js|png|jpg|jpeg|gif|svg)$/)) { // Ignore static files
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        console.log("Session Data:", req.session);
    }
    next();
});

// ✅ Set up EJS templating
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
const authMiddleware = (req, res, next) => {
    if (!req.session.user && !req.session.department) {
        return res.redirect('/'); // Redirect to login if no session exists
    }
    next();
};

// Apply to all routes except login and logout
// Apply authentication middleware only to protected routes
app.use((req, res, next) => {
    if (['/', '/login', '/logout'].includes(req.path)) {
        return next(); // Allow these routes without authentication
    }
    authMiddleware(req, res, next);
});
app.use((req, res, next) => {
    if (req.session.user) {
        res.locals.userName = req.session.user.name; // For Admin Users
    } else if (req.session.department) {
        res.locals.userName = req.session.department.name; // For Department Users
    } else {
        res.locals.userName = null;
    }
    next();
});
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '-1');
    next();
});


// ✅ Routes
app.use('/', require('./routes/authRoutes'));
app.use('/security-head', require('./routes/securityHead'));
app.use('/it-admin', require('./routes/itAdmin'));
app.use('/department', require('./routes/departmentRoutes'));
app.use('/assets', express.static(__dirname + '/assets'));


// ✅ Login page
app.get('/', (req, res) => {
    if (req.session.user && req.session.user.id) { // Ensure session is valid
        if (req.session.user.role === 2) {
            return res.redirect('/it-admin/home');
        } else if (req.session.user.role === 1) {
            return res.redirect('/security-head/home');
        } else if (req.session.user.type === 'department') {
            return res.redirect(`/department/${req.session.department.departmentID}/home`);

        }
    }
    res.render('login'); // Show login page if not authenticated
});

// Route: Add a new incident
app.post("/add-incident", async (req, res) => {
    let connection;
    
    try {
        console.log("✅ Received request body:", req.body);

        const { incident_name, threshold_value, incident_details } = req.body;

        if (!incident_name || !threshold_value || !incident_details) {
            console.log("❌ Missing fields:", req.body);
            return res.status(400).json({ message: "All fields are required." });
        }

        // Get connection from pool
        connection = await pool.getConnection();
        
        // Insert into Database
        const sql = "INSERT INTO add_incidents (incidentName, thresholdValue, details) VALUES (?, ?, ?)";
        const result = await connection.query(sql, [incident_name, threshold_value, incident_details]);
        
        console.log("✅ Incident added successfully:", result);
        res.status(201).json({ message: "✅ Incident added successfully." });
    } catch (error) {
        console.error("❌ Server Error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    } finally {
        // Always release the connection
        if (connection) connection.release();
    }
});



// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});



if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        if (!req.path.match(/\.(css|js|png|jpg|jpeg|gif|svg)$/)) {
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
            console.log("Session Data:", req.session);
        }
        next();
    });
}
