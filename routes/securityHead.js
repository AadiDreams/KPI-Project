    const express = require('express');
    const router = express.Router();
    const multer=require('multer');
    const pool = require('../db'); 
    const bcrypt = require('bcrypt');
    const upload = multer({ dest: 'public/images/' });
    const authenticateSecurityHead = (req, res, next) => {
        if (!req.session.user || req.session.user.role !== 1) {
            console.log("Access denied: User not logged in or incorrect role");
            return res.status(403).send('Access denied.');
        }
        next();
    };
    const mysql = require('mysql2/promise');
    // Security Head Home Page
    router.get('/home', async (req, res) => {
        if (!req.session.user || req.session.user.role !== 1) {
            console.log("Access denied: User not logged in or incorrect role");
            return res.status(403).send('Access denied.');
        }
    
        const { name } = req.session.user;
    
        try {
            // Query the database for updated counts
            const [newIncidents] = await pool.query('SELECT COUNT(*) AS count FROM incidents WHERE report_status = "new"');
            const [pendingActions] = await pool.query('SELECT COUNT(*) AS count FROM investigation WHERE report_status = "pending"');
    
            const thresholdAlerts = 2; // Replace with real logic if applicable
            const recentUpdates = [
                { id: 1, description: 'Incident 1 details', created_at: new Date() },
                { id: 2, description: 'Incident 2 details', created_at: new Date() },
            ];
    
            // Render the page with updated data
            res.render('sh-home', {
                name,
                newIncidents: newIncidents.count,
                pendingActions: pendingActions.count,
                thresholdAlerts,
                recentUpdates,
            });
        } catch (error) {
            console.error('Error fetching incident data:', error);
            res.status(500).send('Internal server error.');
        }
    });
    

    router.get('/incidents', authenticateSecurityHead, async (req, res) => {
        try {
            console.log("Fetching incidents from the database...");
    
            // Query the database for incidents
            const incidents = await pool.query("SELECT * FROM add_incidents");
    
            console.log("Incidents fetched: ", incidents); // Log the data for debugging
    
            // Ensure incidents is always an array
            const { name } = req.session.user;
            res.render("sh-incidents", {
                name,
                incidents: incidents.length > 0 ? incidents : [], // Ensure incidents is an array
            });
        } catch (error) {
            console.error("Error fetching incidents:", error);
            res.status(500).send("Server Error");
        }
    });



    // Security Head Account Page
    router.get('/account', authenticateSecurityHead, async (req, res) => {
        const { role, name } = req.session.user;
        let profilePicture = '/images/default-profile.png'; // Default profile picture

        try {
            // Fetch the profile picture from the database
            const result = await pool.query('SELECT profile_picture FROM admin_users WHERE role = ?', [role]);

            if (result.length > 0 && result[0].profile_picture) {
                profilePicture = result[0].profile_picture;
            }

            // Render the account page with dynamic data
            res.render('sh-account', { name, profilePicture });
        } catch (err) {
            console.error('Error fetching profile picture:', err);
            res.status(500).send('Internal Server Error');
        }
    });

    router.get('/reports', authenticateSecurityHead, async (req, res) => {
        const { name } = req.session.user;
    
        try {
            const reportsNew = await pool.query("SELECT uid, type_of_incident, created_at FROM incidents WHERE report_status = 'new' ORDER BY created_at DESC");
            //const reportsPending = await pool.query("SELECT uid, type_of_incident, created_at FROM incidents WHERE report_status = 'pending'");
            const reportsSolved = await pool.query("SELECT uid, type_of_incident, created_at FROM incidents WHERE report_status = 'action taken' ORDER BY created_at DESC");
    
            res.render('sh-reports', {
                name,
                reportsNew: Array.isArray(reportsNew) ? reportsNew : Object.values(reportsNew),
                //reportsPending: Array.isArray(reportsPending) ? reportsPending : Object.values(reportsPending),
                reportsSolved: Array.isArray(reportsSolved) ? reportsSolved : Object.values(reportsSolved),
            });
        } catch (err) {
            console.error("Error fetching reports:", err.message);
            res.status(500).send("Server Error");
        }
    });


    router.get('/investreports', authenticateSecurityHead, async (req, res) => {
        const { name } = req.session.user;
    
        try {
            const reportsNew = await pool.query("SELECT investigation.uid, incidents.type_of_incident, investigation.department FROM investigation JOIN incidents ON investigation.uid = incidents.uid WHERE investigation.report_status = 'new' ORDER BY investigation.created_at DESC;");
            const reportsPending = await pool.query("SELECT investigation.uid, incidents.type_of_incident, investigation.department FROM investigation JOIN incidents ON investigation.uid = incidents.uid WHERE investigation.report_status = 'pending' ORDER BY investigation.created_at DESC;");
            const reportsSolved = await pool.query("SELECT investigation.uid, incidents.type_of_incident, investigation.department FROM investigation JOIN incidents ON investigation.uid = incidents.uid WHERE investigation.report_status = 'solved' ORDER BY investigation.created_at DESC;");
    
            res.render('sh-investreports', {
                name,
                reportsNew: Array.isArray(reportsNew) ? reportsNew : Object.values(reportsNew),
                reportsPending: Array.isArray(reportsPending) ? reportsPending : Object.values(reportsPending),
                reportsSolved: Array.isArray(reportsSolved) ? reportsSolved : Object.values(reportsSolved),
            });
        } catch (err) {
            console.error("Error fetching reports:", err.message);
            res.status(500).send("Server Error");
        }
    });
    

    router.get('/visualize', authenticateSecurityHead, (req, res) => {
        const { name } = req.session.user;

        res.render('sh-visualize', { name });
    });

    router.get('/notifications', authenticateSecurityHead, (req, res) => {
        const { name } = req.session.user;

        res.render('sh-notifications', { name });
    });

    router.get('/investigation', authenticateSecurityHead, async (req, res) => {
        const { name } = req.session.user;
        const departments = await pool.query("SELECT departmentID, departmentName FROM departments");
        res.render('sh-investigation', { name, departments:departments.length>0?departments:[] });
    });

    // Upload Profile Picture
    router.post('/account/upload-picture', authenticateSecurityHead, upload.single('profile_picture'), async (req, res) => {
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }

        const filePath = `/images/${req.file.filename}`; // Path of the uploaded file

        try {
            // Update the profile picture in the database
            const result = await pool.query('UPDATE admin_users SET profile_picture = ? WHERE role = ?', [filePath, req.session.user.role]);

            if (result.affectedRows > 0) {
                res.redirect('/security-head/account');
            } else {
                res.status(500).send('Failed to update profile picture');
            }
        } catch (err) {
            console.error('Error updating profile picture:', err);
            res.status(500).send('Internal Server Error');
        }
    });

    router.post('/account/update-profile', authenticateSecurityHead, async (req, res) => {
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
                return res.redirect('/security-head/account');
            } else {
                return res.status(500).send('Failed to update name.');
            }
        } catch (err) {
            console.error('Error updating name:', err);
            return res.status(500).send('Internal Server Error');
        }
    });

    router.post('/account/update-password', authenticateSecurityHead, async (req, res) => {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const role = req.session.user.role;

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).send('All fields are required.');
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).send('New password and confirm password do not match.');
        }

        try {
            // Fetch the stored password from the database
            const result = await pool.query('SELECT password FROM admin_users WHERE role = ?', [role]);

            if (result.length === 0) {
                return res.status(404).send('User not found.');
            }

            const storedPassword = result[0].password;

            let isMatch;
            
            // Check if stored password is hashed or plaintext
            if (storedPassword.length === 60) { // bcrypt hash is always 60 characters
                isMatch = await bcrypt.compare(currentPassword, storedPassword);
            } else {
                isMatch = currentPassword === storedPassword; // Direct comparison for plaintext
            }

            if (!isMatch) {
                return res.status(401).send('Current password is incorrect.');
            }

            // Hash the new password before storing it
            const hashedNewPassword = await bcrypt.hash(newPassword, 10);

            // Update password in the database
            const updateResult = await pool.query('UPDATE admin_users SET password = ? WHERE role = ?', [hashedNewPassword, role]);

            if (updateResult.affectedRows > 0) {
                return res.redirect('/security-head/account?success=Password updated successfully');
            } else {
                return res.status(500).send('Failed to update password.');
            }
        } catch (err) {
            console.error('Error updating password:', err);
            return res.status(500).send('Internal Server Error');
        }
    });


    router.post(`/investreports/update-report-status`, authenticateSecurityHead, async (req, res) => {
        const { uid } = req.body;
        const { departmentID } = req.body;
        try {
            
            const result = await pool.query(
                'UPDATE investigation SET report_status = "solved" WHERE uid = ? AND department = ?',
                [uid, departmentID]
            );
    
            if (result.affectedRows > 0) {
                res.json({ success: true, message: "Report status updated successfully." });
            } else {
                res.json({ success: false, message: "No report found to update." });
            }
        } catch (error) {
            console.error("Error updating report status:", error);
            res.status(500).json({ success: false, message: "Internal Server Error" });
        }
    });
    

    module.exports = router;
