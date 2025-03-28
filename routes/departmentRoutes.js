const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db'); // Ensure correct DB connection
const pool = require('../db'); 
const path=require('path');
const PDFDocument=require('pdfkit');
const fs=require('fs');

const router = express.Router();
const isAuthenticated = (req, res, next) => {
    if (!req.session.user || req.session.user.type !== 'department') {  
        return res.status(403).send('Unauthorized Access');
    }
    req.departmentID = req.session.user.departmentID;
    next();
};


router.get('/:departmentID/home', isAuthenticated, async (req, res) => {
    try {
        if (!req.session.user || req.session.user.type !== 'department') {
            return res.redirect('/');
        }

        const departmentID = req.session.user.departmentID; // Get department ID from session
        const deptID = departmentID.split('_')[1];
        console.log(departmentID,deptID)
        const [reportedIncidentsCount] = await pool.query('SELECT COUNT(*) AS count FROM incidents WHERE uid LIKE ?',[`IR/${deptID}%`]);
        const [pendingActions] = await pool.query('SELECT COUNT(*) AS count FROM investigation WHERE department=? AND report_status="pending"',[departmentID]);


        res.render('dpt-home', { 
            departmentName: req.session.user.departmentName, 
            departmentID:departmentID,
            reportedIncidentsCount: reportedIncidentsCount.count,
            pendingActions: pendingActions.count,
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

router.get('/notifications/:uid/pdf', isAuthenticated, async (req, res) => {
    const uid = decodeURIComponent(req.params.uid);
    const userDepartment = req.departmentID;

    console.log("Requested UID:", uid);
    console.log("User Department:", userDepartment);

    try {
        const rows = await pool.query(
            "SELECT * FROM investigation WHERE uid = ? AND department = ?",
            [uid, userDepartment]
        );

        if (!rows || rows.length === 0) {
            console.error("Investigation Report not found in database.");
            return res.status(404).send('Investigation Report not found.');
        }

        const report = rows[0];
        console.log("Report Data:", report);

        const safeUid = uid.replace(/\//g, "_");
        const reportPath = path.join(__dirname, '../public/reports/', `investigation-${safeUid}.pdf`);
        fs.mkdirSync(path.dirname(reportPath), { recursive: true });

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const writeStream = fs.createWriteStream(reportPath);

        writeStream.on('error', (err) => {
            console.error("File writing error:", err);
            return res.status(500).send("Error writing the PDF file.");
        });

        res.setHeader('Content-Disposition', `attachment; filename="investigation-${safeUid}.pdf"`);
        res.setHeader('Content-Type', 'application/pdf');

        doc.pipe(writeStream);

        const colors = {
            primary: '#004d80',
            secondary: '#66b2ff',
            text: '#333333',
        };

        const formatDateTime = (dateTimeStr) => {
            if (!dateTimeStr) return "N/A";
            try {
                return new Date(dateTimeStr).toLocaleString('en-US', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', hour12: true
                });
            } catch {
                return dateTimeStr;
            }
        };

        const addSectionTitle = (text) => {
            doc.fillColor(colors.primary).font("Helvetica-Bold").fontSize(14).text(text).moveDown(0.3);
            doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor(colors.secondary).stroke();
            doc.moveDown(0.5);
        };

        const addSectionContent = (labels, values) => {
            labels.forEach((label, index) => {
                doc.font("Helvetica-Bold").text(`${label}: `, { continued: true }).font("Helvetica").text(values[index] || "N/A");
            });
            doc.moveDown(0.5);
        };

        // Safely parse JSON fields
        const parseJSONSafely = (data) => {
            try {
                return typeof data === 'string' ? JSON.parse(data) : data || [];
            } catch (err) {
                console.error("Error parsing JSON:", err);
                return [];
            }
        };

        const vehicles = parseJSONSafely(report.vehicles);
        const incidents = parseJSONSafely(report.chronological_incidents);

        // Header
        doc.font("Helvetica-Bold").fontSize(22).fillColor(colors.primary).text("INVESTIGATION REPORT", { align: "center" }).moveDown(1);

        // Basic Details
        addSectionTitle("1. Basic Details");
        addSectionContent(
            ["UID", "Date & Time of Incident", "Name of Airport", "Location of Incident", "Type of Operation"],
            [
                report.uid,
                formatDateTime(report.date_time),
                report.name_of_airport,
                report.location_of_incident,
                report.type_of_operation,
            ]
        );

        // Aircraft Details
        addSectionTitle("2. Aircraft Details");
        addSectionContent(
            ["Airline/Operator", "Aircraft Type", "Registration Number", "Flight Number", "Sector", "Phase of Operation"],
            [
                report.airline_operator,
                report.aircraft_type,
                report.registration_no,
                report.flight_no,
                report.sector,
                report.phase_of_operation,
            ]
        );

        // Vehicle Details
        if (vehicles.length > 0) {
            addSectionTitle("3. Vehicle/Equipment Details");
            vehicles.forEach((vehicle, index) => {
                addSectionContent(
                    [`Vehicle ${index + 1} - Type`, "Airside Vehicle Permit", "Equipment No.", "Owner/Operator", "Phase of Operation"],
                    [
                        vehicle.typeOfVehicle,
                        vehicle.airsideVehiclePermit,
                        vehicle.equipmentNo,
                        vehicle.ownerOperator,
                        vehicle.phaseOfOperation,
                    ]
                );
            });
        }

        // Chronological Incidents
        if (incidents.length > 0) {
            addSectionTitle("4. Chronological Summary");
            incidents.forEach((incident, index) => {
                doc.font("Helvetica").text(`${index + 1}. Time: ${incident.time}, Description: ${incident.description}`);
            });
            doc.moveDown(0.5);
        }

        // Additional Sections
        addSectionTitle("5. Additional Details");
        addSectionContent(
            [
                "Brief Description",
                "Action Taken",
                "Damage to Property",
                "Other Damage",
                "Personnel Information",
                "Equipment Information",
                "Metrological Information",
                "Aerodrome Information",
                "Fire",
                "Organization and Management Information",
                "Analysis",
                "Findings",
                "Probable Cause",
                "Contributory Factor",
            ],
            [
                report.brief_description,
                report.action_taken,
                report.damage_to,
                report.other_damage,
                report.personnel_information,
                report.equipment_information,
                report.metrological_information,
                report.aerodrome_information,
                report.fire,
                report.organization_and_management_information,
                report.analysis,
                report.findings,
                report.probable_cause,
                report.contributory_factor,
            ]
        );

        // Footer
        doc.fillColor(colors.text).font("Helvetica-Oblique").fontSize(9)
            .text(`Generated on: ${new Date().toLocaleString()}`, 50, doc.page.height - 50, { align: "left" })
            .text("This report is confidential and intended for authorized personnel only.", doc.page.width / 2, doc.page.height - 50, { align: "center" })
            .text(`Page 1 of 1`, doc.page.width - 50, doc.page.height - 50, { align: "right" });

        doc.end();
        writeStream.on("finish", () => {
            res.download(reportPath, (err) => {
                if (err) console.error("Error sending file:", err);
                setTimeout(() => fs.unlink(reportPath, (unlinkErr) => {
                    if (unlinkErr) console.error("Error deleting file:", unlinkErr);
                }), 2000);
            });
        });

    } catch (error) {
        console.error("Error generating PDF:", error);
        res.status(500).send("Server Error");
    }
});




// Department Logout Route
router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login'); // Redirect to login page after logout
    });
});

module.exports = router;
