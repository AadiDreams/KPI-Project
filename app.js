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

// // ✅ Ensure the upload directory exists
// const uploadDirectory = path.join(__dirname, 'public', 'images');
// if (!fs.existsSync(uploadDirectory)) {
//     fs.mkdirSync(uploadDirectory, { recursive: true });
// }

// // ✅ Configure Multer for file uploads
// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         cb(null, uploadDirectory);
//     },
//     filename: function (req, file, cb) {
//         cb(null, Date.now() + path.extname(file.originalname));
//     }
// });
// const upload = multer({ storage: storage });

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

// Register the visualization routes
app.use('/visualization', require('./routes/visualization'));

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

//incident deletion

app.post("/delete-incident/:id", async (req, res) => {
    let connection;
    try {
        const incidentId = req.params.id;

        // Get connection from pool
        connection = await pool.getConnection();

        // Delete the incident from the database
        const sql = "DELETE FROM add_incidents WHERE incidentName = ?";
        await connection.query(sql, [incidentId]);

        console.log(`✅ Incident with ID ${incidentId} deleted successfully.`);
        
        // Refresh the page after deletion
        res.redirect("/security-head/incidents");
    } catch (error) {
        console.error("❌ Server Error:", error);
        res.status(500).send("Server error. Could not delete the incident.");
    } finally {
        if (connection) connection.release();
    }
});


// load dropdown list dynamiclly for type of incidents

app.get("/type_incidents", async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const results = await connection.query("SELECT incidentName FROM add_incidents");
        
        console.log("✅ Incidents Fetched:", results);
        
        // Extract only incident names from the results
        const incidentNames = results.map(row => row.incidentName);
        res.json(incidentNames);
    } catch (err) {
        console.error("❌ Database Fetch Error:", err);
        res.status(500).json({ message: "Database error", error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// Ensure uploads directory exists
const uploadDirectory = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, { recursive: true });
}

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, uploadDirectory);
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: function(req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed.'));
        }
    }
});




// Endpoint: Submit incident report


app.post('/submit-incident', upload.single('image-upload'), async (req, res) => {
    try {
        // Initialize JSON data with proper empty arrays if not provided
        let chronologicalSummary = '[]';
        let witnesses = '[]';
        
        // Get form data for events and witnesses
        const eventTimes = Array.isArray(req.body['event-time']) ? req.body['event-time'] : [req.body['event-time']];
        const eventDescriptions = Array.isArray(req.body['event-description']) ? req.body['event-description'] : [req.body['event-description']];
        
        const witnessNames = Array.isArray(req.body['witness-name']) ? req.body['witness-name'] : [req.body['witness-name']];
        const witnessOrgs = Array.isArray(req.body['witness-org']) ? req.body['witness-org'] : [req.body['witness-org']];
        const witnessContacts = Array.isArray(req.body['witness-contact']) ? req.body['witness-contact'] : [req.body['witness-contact']];
        
        // Create JSON structures from form data
        if (eventTimes && eventDescriptions && eventTimes.length > 0 && eventDescriptions.length > 0) {
            const events = [];
            for (let i = 0; i < eventTimes.length; i++) {
                if (eventTimes[i] && eventDescriptions[i]) {
                    events.push({
                        time: eventTimes[i],
                        description: eventDescriptions[i]
                    });
                }
            }
            chronologicalSummary = JSON.stringify(events);
        }
        
        if (witnessNames && witnessOrgs && witnessContacts && 
            witnessNames.length > 0 && witnessOrgs.length > 0 && witnessContacts.length > 0) {
            const witnesses_arr = [];
            for (let i = 0; i < witnessNames.length; i++) {
                if (witnessNames[i] && witnessOrgs[i] && witnessContacts[i]) {
                    witnesses_arr.push({
                        name: witnessNames[i],
                        organization: witnessOrgs[i],
                        contact: witnessContacts[i]
                    });
                }
            }
            witnesses = JSON.stringify(witnesses_arr);
        }

        // Get the image path if a file was uploaded
        const imagePath = req.file ? req.file.filename : null;
        console.log('Uploaded file:', req.file);
        console.log('Image path:', imagePath);

        const sql = `
            INSERT INTO incidents (
                date, uid, incident_time, location, description, type_of_incident, no_of_injured,
                injured_person_category, type_of_casualty, incident_details, image_path, alert_received_by,
                alerted_by, alert_time, medical_support, name_of_doctor, name_of_nurse, ambulance_service,
                chronological_events, police_notification, police_station, reporting_time, legal_action, 
                details, damage_details, witnesses, contributing_factors, contributing_factors_details,
                recommendations, status_of_incident, follow_up_actions, comments, submitted_by, designation
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            req.body.date, req.body.uid, req.body['incident-time'], req.body.location, req.body.description,
            req.body['type-of-incident'], req.body['no-of-injured'], req.body['injured-person-category'],
            req.body['type-of-casualty'], req.body['incident-details'], imagePath, req.body['alert-received-by'],
            req.body['alerted-by'], req.body['alert-time'], req.body['medical-support'], req.body['name-of-doctor'],
            req.body['name-of-nurse'], req.body['ambulance-service'], chronologicalSummary, req.body['police-notification'],
            req.body['to-whom'], req.body['reporting-time'], req.body['legal-action'], req.body['details'],
            req.body['damage-to'], witnesses, req.body['contributing-factors'], req.body['contributing-factors-details'],
            req.body['recommendations-for-remedial-actions'], req.body['status-of-incident'], req.body['follow-up-actions'],
            req.body['any-other-comments'], req.body['submitted-name'], req.body['designation']
        ];

        let connection;
        try {
            connection = await pool.getConnection();
            const result = await connection.query(sql, values);
            console.log('Database insertion result:', result);
            res.status(200).send('Incident report submitted successfully!');
        } catch (err) {
            console.error('Database Insertion Error:', err.message);
            res.status(500).send('Error inserting data into the database.');
        } finally {
            if (connection) connection.release();
        }
    } catch (error) {
        console.error('Error processing form submission:', error.message);
        res.status(400).send('Invalid form data. Please check your inputs.');
    }
});

// load dropdown list dynamiclly for uid numbers

app.get("/uid_numbers", async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const results = await connection.query("SELECT uid FROM incidents");
        
        console.log("✅ UID Numbers Fetched:", results);
        
        // Extract only uod number  from the results
        const uid = results.map(row => row.uid);
        res.json(uid);
    } catch (err) {
        console.error("❌ Database Fetch Error:", err);
        res.status(500).json({ message: "Database error", error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// load dropdown list dynamiclly for departments

app.get("/department_names", async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const results = await connection.query("SELECT departmentID FROM departments");
        
        console.log("✅ Departments Fetched:", results);
        
        // Extract only uod number from the results
        const departmentID = results.map(row => row.departmentID);
        res.json(departmentID);
    } catch (err) {
        console.error("❌ Database Fetch Error:", err);
        res.status(500).json({ message: "Database error", error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

//Endpoint: Submit safety investigation report

app.post('/submit-investigation', async (req, res) => {
    try {
        // Log all form field names and values for debugging
        console.log('Complete form data received:', req.body);
        
        // Create a more robust approach to get the airline value
        let airline = null;
        
        // Check all possible field names directly
        const possibleAirlineFields = [
            'airline', 
            'airline_backup', 
            'airline-operator', 
            'airline_operator',
            'airlineOperator'
        ];
        
        // Try each possible field name
        for (const fieldName of possibleAirlineFields) {
            if (req.body[fieldName] && req.body[fieldName] !== '') {
                airline = req.body[fieldName];
                console.log(`Found airline value in field "${fieldName}": ${airline}`);
                break;
            }
        }
        
        // If still not found, search all fields for anything with "airline" in the name
        if (!airline) {
            for (const [key, value] of Object.entries(req.body)) {
                if (key.toLowerCase().includes('airline') && value && value !== '') {
                    console.log(`Found airline-related field: ${key} with value: ${value}`);
                    airline = value;
                    break;
                }
            }
        }
        
        // If airline is still empty, log an error
        if (!airline) {
            console.error('CRITICAL: Could not find airline value in form data');
            airline = 'Unknown Airline'; // Fallback value instead of null
        }
        
        // Handle if airline is an array
        if (Array.isArray(airline)) {
            console.log('Airline was an array:', airline);
            airline = airline[0] || 'Unknown Airline';
            console.log('Using first value from array:', airline);
        }
        
        // Parse JSON data from hidden fields with better error handling
        let vehicles = [];
        let chronologicalIncidents = [];
        
        try {
            vehicles = JSON.parse(req.body.vehicles_json || '[]');
        } catch (e) {
            console.error('Error parsing vehicles JSON:', e);
            vehicles = [];
        }
        
        try {
            chronologicalIncidents = JSON.parse(req.body.incidents_json || '[]');
        } catch (e) {
            console.error('Error parsing incidents JSON:', e);
            chronologicalIncidents = [];
        }
        
        // Get phase of operation value with similar robust approach
        let phaseOfOperationAircraft = null;
        const possiblePhaseFields = [
            'phase-of-operation-aircraft',
            'phase_of_operation_aircraft',
            'phase_of_operation_aircraft_backup',
            'phaseOfOperationAircraft'
        ];
        
        for (const fieldName of possiblePhaseFields) {
            if (req.body[fieldName] && req.body[fieldName] !== '') {
                phaseOfOperationAircraft = req.body[fieldName];
                console.log(`Found phase of operation in field "${fieldName}": ${phaseOfOperationAircraft}`);
                break;
            }
        }
        
        if (!phaseOfOperationAircraft) {
            for (const [key, value] of Object.entries(req.body)) {
                if (key.toLowerCase().includes('phase') && value && value !== '') {
                    console.log(`Found phase-related field: ${key} with value: ${value}`);
                    phaseOfOperationAircraft = value;
                    break;
                }
            }
        }
        
        // Handle if phase is an array
        if (Array.isArray(phaseOfOperationAircraft)) {
            phaseOfOperationAircraft = phaseOfOperationAircraft[0] || '';
        }

        // Count the number of columns in your SQL statement
        const columnCount = 40;

        const sql = `
            INSERT INTO investigation (
                date_time, name_of_airport, location_of_incident, type_of_operation,uid,
                airline_operator, aircraft_type, registration_no, flight_no, sector,
                phase_of_operation, vehicles, chronological_incidents, brief_description,
                action_taken, injuries_fatal_driver, injuries_fatal_ground_staff, injuries_fatal_other,
                injuries_serious_driver, injuries_serious_ground_staff, injuries_serious_other,
                injuries_minor_driver, injuries_minor_ground_staff, injuries_minor_other,
                damage_to, other_damage, personnel_information, equipment_information,
                metrological_information, aerodrome_information, fire,
                organization_and_management_information, analysis, findings, probable_cause,
                contributory_factor, safety_manager, report_date, appendices,department
            ) VALUES (${Array(columnCount).fill('?').join(', ')})
        `;
        
        // Log the final airline value being used just before insertion
        console.log('FINAL airline value being inserted:', airline);
        
        // Process any field that might be an array
        const processField = (field) => {
            if (Array.isArray(field)) {
                return field[0] || '';
            }
            return field || '';
        };
        
        const values = [
            processField(req.body["date-time"]), 
            processField(req.body["name-of-airport"]), 
            processField(req.body["location-of-incident"]),
            processField(req.body["type-of-operation"]),
            processField(req.body["uid-number"]), 
            airline, // This is now properly processed and should not be null
            processField(req.body["aircraft-type"]), 
            processField(req.body["registration-no"]),
            processField(req.body["flight-no"]), 
            processField(req.body["sector"]), 
            phaseOfOperationAircraft,
            JSON.stringify(vehicles), 
            JSON.stringify(chronologicalIncidents), 
            processField(req.body["brief-description"]),
            processField(req.body["action-taken"]), 
            processField(req.body["injuries-fatal-driver"]), 
            processField(req.body["injuries-fatal-ground-staff"]),
            processField(req.body["injuries-fatal-other"]), 
            processField(req.body["injuries-serious-driver"]), 
            processField(req.body["injuries-serious-ground-staff"]),
            processField(req.body["injuries-serious-other"]), 
            processField(req.body["injuries-minor-driver"]), 
            processField(req.body["injuries-minor-ground-staff"]),
            processField(req.body["injuries-minor-other"]), 
            processField(req.body["damage-to"]), 
            processField(req.body["other-damage"]), 
            processField(req.body["personnel-information"]),
            processField(req.body["equipment-information"]), 
            processField(req.body["metrological-report"]), 
            processField(req.body["aerodrome-information"]),
            processField(req.body["fire"]), 
            processField(req.body["organization-and-management-information"]), 
            processField(req.body["analysis"]),
            processField(req.body["findings"]), 
            processField(req.body["probable-cause"]), 
            processField(req.body["contributory-factor"]),
            processField(req.body["safety-manager"]), 
            processField(req.body["date"]), 
            processField(req.body["appendices"]),
            processField(req.body["dpt-name"])
        ];
        
        // Verify the number of values matches the number of columns
        console.log(`Number of values provided: ${values.length}, Expected: ${columnCount}`);
        if (values.length !== columnCount) {
            throw new Error(`Column count (${columnCount}) doesn't match value count (${values.length})`);
        }
        
        // Log all values before insertion for debugging
        console.log('All values being inserted:', values);
        
        let connection;
        try {
            connection = await pool.getConnection();
            const result = await connection.query(sql, values);
            
            // Log successful submission
            console.log('Successfully submitted investigation report:', {
                id: result.insertId,
                vehicleCount: vehicles.length,
                incidentsCount: chronologicalIncidents.length,
                airlineUsed: airline
            });
            
            res.send('Safety Investigation Report submitted successfully!');
        } catch (err) {
            console.error('Database Insertion Error:', err.message);
            
            // Log the problematic values to help with debugging
            console.error('Problem with insertion values:', {
                date: req.body["date-time"],
                airline: airline,
                vehiclesLength: vehicles.length,
                incidentsLength: chronologicalIncidents.length,
                valueCount: values.length
            });
            
            res.status(500).send('Error inserting data into the database.');
        } finally {
            if (connection) connection.release();
        }
    } catch (error) {
        console.error('Error processing form submission:', error.message, error.stack);
        res.status(400).send('Invalid form data. Please check your inputs.');
    }

    
    try {
        // Update report_status for rows with matching UID in the investigation table
        await pool.query(`
            UPDATE incidents
            SET report_status = 'action taken'
            WHERE uid IN (SELECT uid FROM investigation);
        `);
    } catch (error) {
        console.error('Error updating report_status', error);
        res.status(500).send('Server error');
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
