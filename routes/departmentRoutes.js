const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db'); // Ensure correct DB connection
const pool = require('../db'); 
const router = express.Router();
const isAuthenticated = (req, res, next) => {
    if (!req.session.user || req.session.user.type !== 'department') {  
        return res.status(403).send('Unauthorized Access');
    }
    next();
};


router.get('/:departmentID/home', isAuthenticated, async (req, res) => {
    try {
        if (!req.session.user || req.session.user.type !== 'department') {
            return res.redirect('/');
        }

        const departmentID = req.session.user.departmentID; // Get department ID from session

        // Query to count incidents submitted by this department
        const [result] = await db.execute(
            'SELECT COUNT(*) AS total FROM incidents WHERE submitted_by = ?', 
            [departmentID]
        );

        const reportedIncidents = result[0]?.total || 0; // Default to 0 if null

        res.render('dpt-home', { 
            departmentName: req.session.user.departmentName, 
            departmentID:departmentID,
            active: 'home',
            //reportedIncidents // Pass the value to EJS
        });

    } catch (error) {
        console.error("Error fetching incidents:", error);
        res.status(500).send("Internal Server Error");
    }
});
router.get('/:departmentID/account', isAuthenticated, async (req, res) => {
    try {
        const departmentID = req.session.user?.departmentID;

        console.log("🔹 Department ID from session:", departmentID); // Debugging

        if (!departmentID) {
            return res.status(400).send("Session does not have department ID");
        }

        // Fetch department details
        const result = await db.execute("SELECT departmentName FROM departments WHERE departmentID = ?", [departmentID]);

        console.log("🔹 Query result:", result); // Debugging

        // Fix: Access the correct format of returned data
        const rows = Array.isArray(result[0]) ? result[0] : result;

        if (!rows || rows.length === 0) {
            return res.status(404).send("Department not found");
        }

        const departmentName = rows.departmentName || rows[0].departmentName; // Handling both cases

        res.render("dpt-account", {
            departmentName: departmentName,
            departmentID: departmentID,
            active:'account'
        });

    } catch (error) {
        console.error("❌ Error fetching department data:", error);
        return res.status(500).send("Internal Server Error");
    }
});

router.post('/:departmentID/account/update-password', isAuthenticated, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const departmentID = String(req.session.user?.departmentID);

        console.log("🔹 Department ID from session:", departmentID);
        console.log("🔹 User-entered passwords:", { currentPassword, newPassword, confirmPassword });

        if (!departmentID) {
            console.log("❌ No department ID found in session.");
            return res.status(403).send("Unauthorized access.");
        }

        if (!currentPassword?.trim() || !newPassword?.trim() || !confirmPassword?.trim()) {
            console.log("❌ One or more fields are empty.");
            return res.render('dpt-account', { 
                departmentID, 
                departmentName: req.session.user?.departmentName || "Unknown Department",
                error: "All fields are required.", 
                active: 'account',
                message: null
            });
        }

        if (newPassword !== confirmPassword) {
            console.log("❌ New passwords do not match.");
            return res.render('dpt-account', { 
                departmentID, 
                departmentName: req.session.user?.departmentName || "Unknown Department",
                error: "New passwords do not match.", 
                active: 'account',
                message: null
            });
        }

        // Fetch department details including password
        const [rows] = await db.execute(
            "SELECT departmentName, password FROM departments WHERE departmentID = ?", 
            [departmentID]
        );

        console.log("🔹 Query Result:", rows);

        if (!rows.length) {
            console.error("❌ No department found with ID:", departmentID);
            return res.render('dpt-account', { 
                departmentID, 
                departmentName: "Unknown Department",
                error: "Department not found.", 
                active: 'account',
                message: null
            });
        }

        const { departmentName, password: storedHashedPassword } = rows[0];
        console.log("🔹 Extracted departmentName:", departmentName);
        console.log("🔹 Extracted storedHashedPassword:", storedHashedPassword);

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, storedHashedPassword);
        console.log("🔹 Password match:", isMatch);

        if (!isMatch) {
            console.log("❌ Current password is incorrect.");
            return res.render('dpt-account', { 
                departmentID, 
                departmentName,
                error: "Current password is incorrect.", 
                active: 'account',
                message: null
            });
        }

        // Hash new password
        const saltRounds = 10;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
        console.log("🔹 New hashed password:", hashedNewPassword);

        // Update password in DB
        const [updateResult] = await db.execute(
            "UPDATE departments SET password = ? WHERE departmentID = ?", 
            [hashedNewPassword, departmentID]
        );

        console.log("🔹 Update result:", updateResult);

        if (updateResult.affectedRows === 0) {
            console.log("❌ Password update failed.");
            return res.render('dpt-account', { 
                departmentID, 
                departmentName,
                error: "Password update failed. Try again.", 
                active: 'account',
                message: null
            });
        }

        return res.render('dpt-account', { 
            departmentID, 
            departmentName,
            error: null, 
            active: 'account',
            message: "Password updated successfully!"
        });
    } catch (error) {
        console.error("❌ Error updating password:", error);
        return res.render('dpt-account', { 
            departmentID: req.session.user?.departmentID || "Unknown",
            departmentName: req.session.user?.departmentName || "Unknown Department",
            error: "Internal Server Error.", 
            active: 'account',
            message: null
        });
    }
});


router.get('/:departmentID/report', isAuthenticated, async (req, res) => {
    try {
        const departmentID = req.session.user?.departmentID;
        
        console.log("🔹 Department ID from session:", departmentID);

        if (!departmentID) {
            return res.status(400).send("Session does not have department ID");
        }

        res.render("dpt-report", {
            departmentName: req.session.user.departmentName,
            departmentID: departmentID,
            active: 'report' // Set 'reports' as the active page
        });

    } catch (error) {
        console.error("❌ Error loading reports page:", error);
        return res.status(500).send("Internal Server Error");
    }
});

router.get('/:departmentID/notifications', isAuthenticated, async (req, res) => {
    try {
        const departmentID = req.params.departmentID; // Get department ID from URL
        if (!req.session.user || String(req.session.user.departmentID) !== String(departmentID)) {
            return res.status(403).send('Unauthorized Access');
        }
        

        const reportsNew = await pool.query("SELECT investigation.uid, incidents.type_of_incident, investigation.created_at FROM investigation JOIN incidents ON investigation.uid = incidents.uid WHERE investigation.report_status = 'new' AND investigation.department = ?;",
            [departmentID]);
        const reportsPending = await pool.query("SELECT investigation.uid, incidents.type_of_incident, investigation.created_at FROM investigation JOIN incidents ON investigation.uid = incidents.uid WHERE investigation.report_status = 'pending' AND investigation.department = ?;",
                [departmentID]);
        const reportsSolved = await pool.query("SELECT investigation.uid, incidents.type_of_incident, investigation.created_at FROM investigation JOIN incidents ON investigation.uid = incidents.uid WHERE investigation.report_status = 'solved' AND investigation.department = ?;",
            [departmentID]);
    

        res.render('dpt-notifications', { 
            departmentName: req.session.user.departmentName, 
            departmentID: departmentID,
            reportsNew: Array.isArray(reportsNew) ? reportsNew : Object.values(reportsNew),
            reportsPending: Array.isArray(reportsPending) ? reportsPending : Object.values(reportsPending),
            reportsSolved: Array.isArray(reportsSolved) ? reportsSolved : Object.values(reportsSolved),
            active: 'notifications'
        });

    } catch (error) {
        console.error("❌ Error fetching notifications:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Department Logout Route
router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login'); // Redirect to login page after logout
    });
});

module.exports = router;
