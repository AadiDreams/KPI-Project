const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../db');

// Login Route
router.post('/login', async (req, res) => {
    try {
        const { loginType, username, departmentID, password } = req.body;

        console.log("Received login request:", { loginType, username, departmentID });

        if (!password) {
            console.log("Login failed: Password missing");
            return res.status(400).json({ error: 'Password is required' });
        }

        let query, values, user, redirectUrl;

        if (loginType === 'admin') {
            if (!username) {
                console.log("Login failed: Username missing");
                return res.status(400).json({ error: 'Username is required' });
            }

            // Use case-insensitive comparison for username
            query = 'SELECT * FROM admin_users WHERE LOWER(username) = LOWER(?)';
            values = [username];
            console.log(`Searching for admin user with username: ${username}`);

        } else if (loginType === 'department') {
            if (!departmentID) {
                console.log("Login failed: Department ID missing");
                return res.status(400).json({ error: 'Department ID is required' });
            }

            query = 'SELECT * FROM departments WHERE departmentID = ?';
            values = [departmentID];
            console.log(`Searching for department with ID: ${departmentID}`);

        } else {
            console.log("Login failed: Invalid login type");
            return res.status(400).json({ error: 'Invalid login type' });
        }

        // Execute query
        console.log("Executing query:", query, "with values:", values);
        const [rows] = await pool.execute(query, values);

        console.log("Query result:", JSON.stringify(rows));

        if (!rows || rows.length === 0) {
            console.log("Login failed: User not found in database");
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        user = Array.isArray(rows) ? rows[0] : rows;
        console.log("User found:", JSON.stringify(user));

        if (!user || !user.password) {
            console.log("Login failed: No password stored for user");
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        console.log("Comparing entered password with stored hash...");
        console.log("Stored Hash:", user.password);

        // For security, don't log the actual password in production
        console.log("Password length:", password.length);

        const isPasswordValid = await bcrypt.compare(password, user.password);
        console.log("Password comparison result:", isPasswordValid);

        if (!isPasswordValid) {
            console.log("Login failed: Incorrect password");
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Determine redirect URL based on role
        if (loginType === 'admin') {
            console.log("Admin login successful, role:", user.role);

            if (user.role === 2) {
                redirectUrl = '/it-admin/home';
            } else if (user.role === 1) {
                redirectUrl = '/security-head/home';
            } else {
                console.log("Login failed: Unknown admin role:", user.role);
                return res.status(400).json({ error: 'Unknown admin role' });
            }

            // Store user in session
            req.session.user = {
                id: user.id,
                type: 'admin',
                role: user.role,
                username: user.username,
                name: user.name || user.username
            };

        } else if (loginType === 'department') {
            console.log(`Department login successful for departmentID: ${user.departmentID}`);
            redirectUrl = `/department/${user.departmentID}/home`;

            // Store user in session
            req.session.user = {
                id: user.id,
                type: 'department',
                departmentID: user.departmentID,  // Ensure this is stored
                departmentName: user.departmentName || `Department ${user.departmentID}`
            };
        }

        console.log("Login successful, redirecting to:", redirectUrl);
        console.log("Session data:", req.session.user);

        res.redirect(redirectUrl);

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout Route
router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).send('Internal server error.');
        }
        res.clearCookie('connect.sid', { path: '/' });
        console.log("User logged out successfully");
        return res.redirect('/');
    });
});

module.exports = router;
