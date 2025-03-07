const express = require('express');
const router = express.Router();
const pool = require('../db'); // Ensure this path matches your database connection file
const bcrypt = require('bcrypt');
const multer = require('multer');
const upload = multer({ dest: 'public/images/' });

// Middleware to check IT Admin authentication
const isITAdmin = (req, res, next) => {
    if (!req.session.user) {
        console.log("No user session. Redirecting to login.");
        return res.redirect('/');
    }
    if (req.session.user.role !== 2) {
        console.log("Incorrect role. Access Denied.");
        return res.status(403).send('Access Denied.');
    }
    next();
};

// IT Admin Home Page
router.get('/home', isITAdmin, async (req, res) => {
    const role = req.session.user.role;
    let adminName = req.session.user.name || 'Admin';
    let profileIcon = '/images/default-profile.png';

    try {
        const [result] = await pool.query('SELECT name, profile_picture FROM admin_users WHERE role = ?', [role]);
        if (result.length > 0) {
            adminName = result[0].name || adminName;
            req.session.user.name = adminName;

            if (result[0].profile_picture) {
                profileIcon = result[0].profile_picture;
            }
        }

        res.render('it-home', {
            adminName,
            profileIcon,
            departmentsMonitored: 5,
            systemHealth: "Good",
            activeUsers: 20,
            active: 'home'
        });
    } catch (err) {
        console.error('Error fetching name:', err);
        res.status(500).send('Internal Server Error');
    }
});

// IT Admin Account Page
router.get('/account', isITAdmin, async (req, res) => {
    const role = req.session.user.role;
    let profileIcon = '/images/default-profile.png';

    try {
        console.log("IT Admin Session before DB fetch in account:", req.session.user);

        const [result] = await pool.query('SELECT name, profile_picture FROM admin_users WHERE role = ?', [role]);

        if (result.length > 0) {
            req.session.user.name = result[0].name || 'Admin';
            req.session.user.profile_picture = result[0].profile_picture || profileIcon;

            profileIcon = req.session.user.profile_picture;
        }

        console.log("IT Admin Session after DB fetch in account:", req.session.user);

        res.render('it-account', { 
            adminName: req.session.user.name, 
            profileIcon, 
            active: 'account'
        });
    } catch (err) {
        console.error('Error fetching profile picture:', err);
        res.status(500).send('Internal Server Error');
    }
});

// IT Admin Reports Page
router.get('/reports', isITAdmin, (req, res) => {
    res.render('it-admin/reports', { name: req.session.user.name });
});

// IT Admin Notifications Page
router.get('/notifications', isITAdmin, (req, res) => {
    res.render('it-admin/notifications', { name: req.session.user.name });
});

// IT Admin Update Profile
router.post('/account/update-profile', isITAdmin, async (req, res) => {
    const { name } = req.body;
    const role = req.session.user.role;

    if (!name.trim()) {
        return res.status(400).send('Name cannot be empty.');
    }

    try {
        const result = await pool.query('UPDATE admin_users SET name = ? WHERE role = ?', [name, role]);

        if (result.affectedRows > 0) {
            // Update session immediately
            req.session.user.name = name;
            return res.redirect('/it-admin/account');
        } else {
            return res.status(500).send('Failed to update name.');
        }
    } catch (err) {
        console.error('Error updating name:', err);
        return res.status(500).send('Internal Server Error');
    }
});


// IT Admin Update Password
router.post('/account/update-password', isITAdmin, async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const role = req.session.user.role;

    if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).send('All fields are required.');
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).send('New password and confirm password do not match.');
    }

    try {
        const [result] = await pool.query('SELECT password FROM admin_users WHERE role = ?', [role]);

        if (result.length === 0) {
            return res.status(404).send('User not found.');
        }

        const storedPassword = result[0].password;
        let isMatch = storedPassword.length === 60 ? await bcrypt.compare(currentPassword, storedPassword) : currentPassword === storedPassword;

        if (!isMatch) {
            return res.status(401).send('Current password is incorrect.');
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        const [updateResult] = await pool.query('UPDATE admin_users SET password = ? WHERE role = ?', [hashedNewPassword, role]);

        if (updateResult.affectedRows > 0) {
            return res.redirect('/it-admin/account?success=Password updated successfully');
        } else {
            return res.status(500).send('Failed to update password.');
        }
    } catch (err) {
        console.error('Error updating password:', err);
        return res.status(500).send('Internal Server Error');
    }
});

// IT Admin Upload Profile Picture
router.post('/account/upload-picture', isITAdmin, upload.single('profile_picture'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const filePath = `/images/${req.file.filename}`;

    try {
        const result = await pool.query('UPDATE admin_users SET profile_picture = ? WHERE role = ?', [filePath, req.session.user.role]);

        if (result.affectedRows > 0) {
            req.session.user.profile_picture = filePath;
            req.session.save((err) => {
                if (err) {
                    console.error("Error saving session:", err);
                    return res.status(500).send("Failed to update session.");
                }
                return res.redirect('/it-admin/account');
            });
        } else {
            res.status(500).send('Failed to update profile picture');
        }
    } catch (err) {
        console.error('Error updating profile picture:', err);
        res.status(500).send('Internal Server Error');
    }
});


// IT Admin Department Page
router.get('/department', isITAdmin, async (req, res) => {
    const { name } = req.session.user;
    let profileIcon = '/images/default-profile.png';

    try {
        const [result] = await pool.query('SELECT profile_picture FROM admin_users WHERE name = ?', [name]);
        if (result.length > 0 && result[0].profile_picture) {
            profileIcon = result[0].profile_picture;
        }

        const [departmentsData] = await pool.query('SELECT * FROM departments');
        const departments = departmentsData || [];

        res.render('it-department', { adminName: name, profileIcon, departments, active: 'department' });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
