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

            query = 'SELECT * FROM admin_users WHERE username = ?';
            values = [username];

        } else if (loginType === 'department') {
            if (!departmentID) {
                console.log("Login failed: Department ID missing");
                return res.status(400).json({ error: 'Department ID is required' });
            }

            query = 'SELECT * FROM departments WHERE departmentID = ?';
            values = [departmentID];

        } else {
            console.log("Login failed: Invalid login type");
            return res.status(400).json({ error: 'Invalid login type' });
        }

        // Execute query
        console.log("Executing query:", query, "with values:", values);
        const [rows] = await pool.execute(query, values);

        if (!rows || rows.length === 0) {
            console.log("Login failed: User not found in database");
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        user = rows[0];
        console.log("User found:", user);

        if (!user || !user.password) {
            console.log("Login failed: No password stored for user");
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        console.log("Comparing passwords: Entered:", password, "Stored Hash:", user.password);
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            console.log("Login failed: Incorrect password");
            return res.status(401).json({ error: 'Incorrect password' });
        }

        // Determine redirect URL based on role
        if (loginType === 'admin') {
            if (user.role === 2) {
                redirectUrl = '/admin/it-home';
            } else if (user.role === 1) {
                redirectUrl = '/admin/security-home';
            } else {
                console.log("Login failed: Unknown admin role");
                return res.status(400).json({ error: 'Unknown admin role' });
            }
        } else if (loginType === 'department') {
            redirectUrl = '/department/home';
        }

        // Store user in session
        req.session.user = {
            id: user.id,
            type: loginType,
            role: user.role || null,
            username: user.username || user.departmentID,
        };

        console.log("Login successful, redirecting to:", redirectUrl);
        res.json({ message: 'Login successful', redirect: redirectUrl });

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
        res.clearCookie('connect.sid', { path: '/' }); // ✅ Ensures session cookie is cleared
        console.log("User logged out successfully");
        return res.redirect('/'); // ✅ Redirects to login page after logout
    });
});

module.exports = router;
