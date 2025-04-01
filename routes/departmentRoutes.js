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

    try {
        // Validate UID and user department
        if (!uid) return res.status(400).send('Invalid UID');
        
        // Fetch investigation data
        const rows = await pool.query(
            "SELECT * FROM investigation WHERE uid = ? AND department = ?", 
            [uid, userDepartment]
        );
        
        if (!rows || rows.length === 0) return res.status(404).send('Investigation Report not found.');

        const report = rows[0];

        // Generate safe filename
        const safeUid = uid.replace(/[^a-zA-Z0-9-_]/g, '_');
        const reportPath = path.join(__dirname, '../public/reports', `investigation-${safeUid}.pdf`);

        // Ensure reports directory exists
        fs.mkdirSync(path.dirname(reportPath), { recursive: true });

        // Define watermark path (adjust this to your actual watermark image path)
        const watermarkPath = path.join(__dirname, '../public/images/wm.png');
        
        // Define logo path
        const logoPath = path.join(__dirname, '../public/images/logo.png');

        // Create PDF document - adjusted margins to fit more content per page
        const doc = new PDFDocument({
            margins: { top: 70, bottom: 60, left: 40, right: 40 },
            size: 'A4',
            bufferPages: true 
        });

        // Store page references to add watermark at the end
        const pageRefs = [];

        // Try to register Nunito Sans font with error handling
        try {
            const fontPath = path.join(__dirname, '../public/fonts/NunitoSans-BoldItalic.ttf');
            // Check if font file exists before registering
            if (fs.existsSync(fontPath)) {
                doc.registerFont('NunitoSans-BoldItalic', fontPath);
            } else {
                console.log("Font file not found, will use fallback font");
            }
        } catch (err) {
            console.log("Error registering font:", err);
            // Continue without the custom font
        }

        const writeStream = fs.createWriteStream(reportPath);
        writeStream.on('error', err => res.status(500).send("Error writing the PDF file."));

        res.setHeader('Content-Disposition', `attachment; filename="investigation-${safeUid}.pdf"`);
        res.setHeader('Content-Type', 'application/pdf');

        doc.pipe(writeStream);

        // Color Theme - Updated primary color to FF4444
        const colors = {
            primary: '#FF4444',
            secondary: '#66b2ff',
            background: '#F8F9FA',
            text: '#333333'
        };

        // Utility functions
        const formatValue = value => value ? String(value).trim() : 'N/A';
        const parseJSONSafely = json => {
            try {
                return typeof json === 'string' ? JSON.parse(json) : json || [];
            } catch {
                return [];
            }
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

        const pageHeight = doc.page.height;
        const footerHeight = 50; // Reduced footer height
        const contentEndY = pageHeight - footerHeight;

        // Modified watermark function - to be applied after all content is added
        const addWatermarkToPage = (pageRef) => {
            doc.switchToPage(pageRef);
            doc.save();
            
            try {
                // Check if watermark file exists
                if (fs.existsSync(watermarkPath)) {
                    // Define exact dimensions for watermark
                    const watermarkWidth = 180; // Width in points (72 points = 1 inch)
                    const watermarkHeight = 180; // Height in points
                    
                    // Calculate center position
                    const centerX = (doc.page.width - watermarkWidth) / 2;
                    const centerY = (doc.page.height - watermarkHeight) / 2;
                    
                    // Add the watermark with opacity and centered
                    doc.opacity(0.15) // Set opacity for watermark
                       .image(watermarkPath, centerX, centerY, {
                            width: watermarkWidth,
                            height: watermarkHeight
                        });
                }
            } catch (err) {
                console.error("Watermark error:", err);
                // Continue without watermark if error occurs
            }
            
            doc.restore();
        };

        // Header function with logo and font fallback - reduced height
        const addHeader = () => {
            const currentY = doc.y;
            doc.y = 15;
            
            // Add line
            doc.lineWidth(3).moveTo(40, 30).lineTo(doc.page.width - 40, 30).stroke(colors.primary);
            
            // Try to use Nunito Sans with fallback to Helvetica-BoldOblique if not available
            try {
                doc.fontSize(12).fillColor(colors.text).font('NunitoSans-BoldItalic').text('Kannur International Airport', 40, 15);
            } catch (err) {
                // Fallback to a standard font that's always available in PDFKit
                doc.fontSize(12).fillColor(colors.text).font('Helvetica-BoldOblique').text('Kannur International Airport', 40, 15);
            }
            
            try {
                // Check if logo file exists
                if (fs.existsSync(logoPath)) {
                    // Add logo on right side with specific dimensions
                    const logoWidth = 80; // Width in points (72 points = 1 inch)
                    const logoHeight = 25; // Height in points
                    const logoX = doc.page.width - 40 - logoWidth; // Position from right edge
                    const logoY = 3; // Vertical position to center with text
                    
                    doc.image(logoPath, logoX, logoY, {
                        width: logoWidth,
                        height: logoHeight
                    });
                }
            } catch (err) {
                console.error("Logo error:", err);
                // Continue without logo if error occurs
            }
            
            doc.y = currentY > 45 ? currentY : 45;
        };

        // Track pages for watermark
        pageRefs.push(doc.bufferedPageRange().start);

        // On new page, add header and track page reference
        doc.on('pageAdded', () => {
            addHeader();
            pageRefs.push(doc.bufferedPageRange().count - 1);
        });

        // Add header to first page
        addHeader();
        
        // Function to add consistently positioned heading
        const addSectionHeading = (text) => {
            const y = doc.y;
            doc.fontSize(14).fillColor(colors.primary).font('Helvetica-Bold').text(text, 40, y);
            doc.moveDown(0.3); // Reduced spacing
        };
        
        // Table function with consistent heading positioning - optimized for space
        const createFullTable = (doc, title, data) => {
            if (doc.y > contentEndY - 100) doc.addPage();
            
            // Use absolute positioning for the heading
            addSectionHeading(title);
            
            const startX = 40, pageWidth = doc.page.width - 80, rowHeight = 20;
            const colWidths = [pageWidth * 0.4, pageWidth * 0.6];
            let startY = doc.y;

            Object.entries(data).forEach(([key, value], index) => {
                if (startY + rowHeight > contentEndY - 20) {
                    doc.addPage();
                    startY = doc.y;
                }
                doc.fillColor(index % 2 === 0 ? '#FFFFFF' : colors.background)
                   .rect(startX, startY, pageWidth, rowHeight).fill();
                doc.fillColor(colors.text).font('Helvetica-Bold').fontSize(10)
                   .text(formatValue(key), startX + 5, startY + 5, { width: colWidths[0] });
                doc.font('Helvetica').fontSize(10)
                   .text(formatValue(value), startX + colWidths[0], startY + 5, { width: colWidths[1] });
                startY += rowHeight;
            });
            doc.y = startY + 5; // Reduced padding
        };

        // Create multiple column table function (for injuries table)
        const createMultiColumnTable = (doc, title, headers, data) => {
            if (doc.y > contentEndY - 120) doc.addPage();
            
            addSectionHeading(title);
            
            const startX = 40, pageWidth = doc.page.width - 80, rowHeight = 25;
            const colCount = headers.length;
            const colWidth = pageWidth / colCount;
            
            let startY = doc.y;
            
            // Draw header row
            doc.fillColor(colors.primary).rect(startX, startY, pageWidth, rowHeight).fill();
            
            // Add header text
            headers.forEach((header, index) => {
                doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10)
                   .text(header, startX + (colWidth * index) + 5, startY + 5, { width: colWidth - 10, align: 'center' });
            });
            
            startY += rowHeight;
            
            // Draw data rows
            data.forEach((row, rowIndex) => {
                if (startY + rowHeight > contentEndY - 20) {
                    doc.addPage();
                    startY = doc.y;
                }
                
                doc.fillColor(rowIndex % 2 === 0 ? '#FFFFFF' : colors.background)
                   .rect(startX, startY, pageWidth, rowHeight).fill();
                
                // Add row data
                row.forEach((cell, cellIndex) => {
                    doc.fillColor(colors.text).font('Helvetica').fontSize(10)
                       .text(formatValue(cell), startX + (colWidth * cellIndex) + 5, startY + 5, { 
                           width: colWidth - 10, 
                           align: 'center' 
                       });
                });
                
                startY += rowHeight;
            });
            
            doc.y = startY + 5; // Reduced padding
        };

        // Chronological incidents table with action column
        const addChronologicalTable = (title, incidents) => {
            if (doc.y > contentEndY - 120) doc.addPage();
            
            addSectionHeading(title);
            
            const startX = 40, pageWidth = doc.page.width - 80, rowHeight = 25;
            const colWidths = [pageWidth * 0.2, pageWidth * 0.4, pageWidth * 0.4]; // Time, Description, Action
            
            let startY = doc.y;
            
            // Draw header row
            doc.fillColor(colors.primary).rect(startX, startY, pageWidth, rowHeight).fill();
            
            // Add header text
            doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10)
               .text('Time(24 Hrs)', startX + 5, startY + 5, { width: colWidths[0] - 5, align: 'center' })
               .text('Description', startX + colWidths[0] + 5, startY + 5, { width: colWidths[1] - 5, align: 'center' })
               .text('Action', startX + colWidths[0] + colWidths[1] + 5, startY + 5, { width: colWidths[2] - 5, align: 'center' });
            
            startY += rowHeight;
            
            // Draw data rows
            incidents.forEach((incident, index) => {
                const action = incident.action || 'N/A'; // Handle case where action might not exist in data
                
                // Check if we need a new page for this row
                if (startY + rowHeight > contentEndY - 20) {
                    doc.addPage();
                    startY = doc.y;
                }
                
                // Calculate height needed for this row based on text content
                const descriptionHeight = doc.heightOfString(formatValue(incident.description), { 
                    width: colWidths[1] - 10, 
                    fontSize: 10 
                });
                const actionHeight = doc.heightOfString(formatValue(action), { 
                    width: colWidths[2] - 10, 
                    fontSize: 10 
                });
                const rowContentHeight = Math.max(descriptionHeight, actionHeight, rowHeight - 10);
                const adjustedRowHeight = rowContentHeight + 10; // Add padding
                
                // Draw row background
                doc.fillColor(index % 2 === 0 ? '#FFFFFF' : colors.background)
                   .rect(startX, startY, pageWidth, adjustedRowHeight).fill();
                
                // Add cell content with proper positioning
                doc.fillColor(colors.text).font('Helvetica').fontSize(10)
                   .text(formatValue(incident.time), startX + 5, startY + 5, { 
                       width: colWidths[0] - 10,
                       align: 'center'
                   })
                   .text(formatValue(incident.description), startX + colWidths[0] + 5, startY + 5, { 
                       width: colWidths[1] - 10
                   })
                   .text(formatValue(action), startX + colWidths[0] + colWidths[1] + 5, startY + 5, { 
                       width: colWidths[2] - 10
                   });
                
                startY += adjustedRowHeight;
            });
            
            doc.y = startY + 5; // Reduced padding
        };

        // List function with pagination and consistent heading positioning
        const addItemList = (title, items, formatter) => {
            if (doc.y > contentEndY - 100) doc.addPage();
            
            // Use absolute positioning for the heading
            addSectionHeading(title);
            
            items.forEach((item, index) => {
                if (doc.y > contentEndY - 50) doc.addPage();
                doc.font('Helvetica').fontSize(10).fillColor(colors.text).text(`${index + 1}. ${formatter(item)}`);
            });
            doc.moveDown(0.5); // Reduced spacing
        };

        // Modified signature block function to match the specified format
        const addSignatureBlock = () => {
            // Define lineStartX variable that was missing in original code
            const lineStartX = 40;
            
            // Position and date
            doc.font('Helvetica').fontSize(10)
               
            
        };

        // Add title with absolute positioning
        const y = doc.y;
        doc.font('Helvetica-Bold').fontSize(18).fillColor(colors.primary)
           .text('Investigation Report', 40, y);
        doc.moveDown(0.5); // Reduced spacing

        // Parse JSON fields for vehicles and incidents
        const vehicles = parseJSONSafely(report.vehicles);
        const incidents = parseJSONSafely(report.chronological_incidents);

        // Create injuries data (assuming these fields exist in the DB or provide defaults)
        const injuries = {
            driver: report.injuries_driver || { fatal: 0, serious: 0, minor: 0 },
            groundStaff: report.injuries_ground_staff || { fatal: 0, serious: 0, minor: 0 },
            others: report.injuries_others || { fatal: 0, serious: 0, minor: 0 }
        };

        // Basic Details Section
        createFullTable(doc, 'Basic Details', {
            'UID': report.uid,
            'Date & Time of Incident(IST)': formatDateTime(report.date_time),
            'Name of Airport': report.name_of_airport,
            'Location of Incident': report.location_of_incident,
            'Type of Operation': report.type_of_operation
        });

        // Aircraft Details Section
        createFullTable(doc, 'Details of Aircraft Involved', {
            'Name of Airline/Operator': report.airline_operator,
            'Aircraft Type': report.aircraft_type,
            'Registration Number': report.registration_no,
            'Flight Number': report.flight_no,
            'Sector': report.sector,
            'Phase of Operation': report.phase_of_operation
        });

        // Vehicle/Equipment Details - condensed for space efficiency
        if (vehicles.length > 0) {
            vehicles.forEach((vehicle, index) => {
                createFullTable(doc, `Details of Vehicles/Equipments,(Vehicle ${index + 1})`, {
                    'Type of Vehicle/Equipment': vehicle.typeOfVehicle,
                    'Airside Vehicle Permit (AVP)': vehicle.airsideVehiclePermit,
                    'Equipment No.': vehicle.equipmentNo,
                    'Owner/Operator/GHSP': vehicle.ownerOperator,
                    'Phase of Operation': vehicle.phaseOfOperation
                });
            });
        }

        // Factual Information Section
        addSectionHeading('1. Factual Information');
        doc.moveDown(0.3); // Reduced spacing

        // Brief Description
        createFullTable(doc, '1.1. Brief Description - A brief narrative of the incident', {
            'Brief Description': report.brief_description
        });

        // Chronological Incidents
        if (incidents.length > 0) {
            addChronologicalTable('1.1.1. Chronological summary of the incident', incidents);
        }

        // Action Taken
        createFullTable(doc, '1.1.2. Action taken', {
            'Action Taken': report.action_taken
        });

        // Injuries to Persons
        const injuriesHeaders = ['Injuries', 'Driver/Equipment Operator', 'Ground Staff', 'Others'];
        const injuriesData = [
            ['Fatal', injuries.driver.fatal, injuries.groundStaff.fatal, injuries.others.fatal],
            ['Serious', injuries.driver.serious, injuries.groundStaff.serious, injuries.others.serious],
            ['Minor/None', injuries.driver.minor, injuries.groundStaff.minor, injuries.others.minor]
        ];
        createMultiColumnTable(doc, '1.2. Injuries to Persons', injuriesHeaders, injuriesData);

        // Damage Information
        createFullTable(doc, '1.3. Damage to Aircraft/Vehicle/Equipment', {
            'Damage to Property': report.damage_to
        });

        createFullTable(doc, '1.4. Other Damage', {
            'Other Damage': report.other_damage
        });

        // Technical Information - condensed where possible
        const personalInfo = {
            'Details of the Equipment Operator': report.personnel_information
        };
        const technicalInfo = {
            'Equipment Information': report.equipment_information,
            'Metrological Information': report.metrological_information,
            'Aerodrome Information': report.aerodrome_information,
            'Fire': report.fire,
            'Organization and Management Information': report.organization_and_management_information
        };

        createFullTable(doc, '1.5. Personnel Information', personalInfo);
        createFullTable(doc, '1.6-1.10. Technical Information', technicalInfo);

        // Analysis Section
        createFullTable(doc, '2. Analysis', {
            'Analysis': report.analysis
        });

        // Conclusions Section
        addSectionHeading('3. Conclusions');
        doc.moveDown(0.3); // Reduced spacing

        createFullTable(doc, '3.1 Findings', {
            'Findings': report.findings
        });

        createFullTable(doc, '3.2 Probable Cause', {
            'Probable Cause': report.probable_cause,
            'Contributory Factor': report.contributory_factor
        });

        // Safety Recommendations
        createFullTable(doc, '4. Safety Recommendations', {
            'Safety Recommendations': report.safety_recommendations || 'N/A'
        });

        // Add a small space before signature block - fixed spacing issue
        doc.moveDown(0.5);

        // Add Safety Manager signature block between sections 4 and 5
        addSignatureBlock();

        // Appendices Section if applicable
        if (report.appendices) {
            createFullTable(doc, '5. Appendices', {
                'Appendices': report.appendices
            });
        } else {
            addSectionHeading('5. Appendices');
            doc.font('Helvetica').fontSize(10).fillColor(colors.text).text('N/A');
            doc.moveDown(0.5); // Reduced spacing
        }

        // Modified Footer with only bottom line
        const addFooter = () => {
            const totalPageCount = doc.bufferedPageRange().count;
            for (let i = 0; i < totalPageCount; i++) {
                doc.switchToPage(i);
                const bottomPosition = doc.page.height - 40;
                doc.lineWidth(2).moveTo(40, bottomPosition - 10).lineTo(doc.page.width - 40, bottomPosition - 10).stroke(colors.primary);
            }
        };

        // Add footers first
        addFooter();
        
        // Now add watermarks on top of everything
        pageRefs.forEach(pageRef => {
            addWatermarkToPage(pageRef);
        });

        doc.end();

        writeStream.on("finish", () => {
            res.download(reportPath, (err) => {
                if (err) console.error("Download error:", err);
                // Delete the file after download
                setTimeout(() => fs.unlink(reportPath, (unlinkErr) => {
                    if (unlinkErr) console.error("File deletion error:", unlinkErr);
                }), 2000);
            });
        });
    } catch (error) {
        console.error("PDF Generation Error:", error);
        res.status(500).send("Internal Server Error");
    }
});
async function generateNextUID(departmentID) {
    try {
        // Extract department code from the department ID (e.g., "DM_IT")
        const deptCode = departmentID.split('_')[1];
        
        // Get current year
        const currentYear = new Date().getFullYear();
        
        // Find the highest sequence number for this department (across all years)
        // This ensures sequential numbering regardless of the year
        const [rows] = await pool.query(
            'SELECT MAX(SUBSTRING_INDEX(SUBSTRING_INDEX(uid, "/", 3), "/", -1)) as max_seq ' +
            'FROM incidents ' +
            'WHERE uid LIKE ?',
            [`IR/${deptCode}/%`]  // Removed the year filter to get the highest sequence across all years
        );
        
        console.log("Query result for UID generation:", JSON.stringify(rows));
        
        // Initialize nextSeq to 1 (default for first entry)
        let nextSeq = 1;
        
        // Check if result is valid and has the max_seq property
        if (rows && rows.length > 0 && rows[0].max_seq !== null && rows[0].max_seq !== undefined) {
            const parsedSeq = parseInt(rows[0].max_seq);
            if (!isNaN(parsedSeq)) {
                nextSeq = parsedSeq + 1;
            }
        }
        
        // Format the sequence number with leading zeros (e.g., 001, 023, 156)
        const formattedSeq = nextSeq.toString().padStart(3, '0');
        
        // Create the complete UID
        const uid = `IR/${deptCode}/${formattedSeq}/${currentYear}`;
        
        console.log(`Generated UID: ${uid}, Department: ${deptCode}, Next sequence: ${nextSeq}`);
        
        return uid;
    } catch (error) {
        console.error("Error generating UID:", error);
        // Return a fallback UID if there's an error
        const deptCode = departmentID.split('_')[1] || 'XX';
        const currentYear = new Date().getFullYear();
        return `IR/${deptCode}/001/${currentYear}`;
    }
}

// The route handler looks good, no changes needed:
// router.get('/:departmentID/next-uid', isAuthenticated, async (req, res) => {
//     try {
//         const departmentID = req.session.user.departmentID;
//         const nextUID = await generateNextUID(departmentID);
//         
//         res.json({ success: true, uid: nextUID });
//     } catch (error) {
//         console.error("Error fetching next UID:", error);
//         res.status(500).json({ success: false, error: "Internal Server Error" });
//     }
// });

// Add this route to get the next UID for a department
router.get('/:departmentID/next-uid', isAuthenticated, async (req, res) => {
    try {
        const departmentID = req.session.user.departmentID;
        const nextUID = await generateNextUID(departmentID);
        
        res.json({ success: true, uid: nextUID });
    } catch (error) {
        console.error("Error fetching next UID:", error);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});


// Department Logout Route
router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login'); // Redirect to login page after logout
    });
});




module.exports = router;
