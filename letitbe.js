
app.post('/login', async (req, res) => {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).send('Username and password are required.');
        }

        try {
            const result = await pool.query('SELECT * FROM admin_users WHERE username = ?', [username]);

            if (!result || result.length === 0) {
                return res.status(401).send('Invalid username or password.');
            }

            const user = result[0];

            const storedPassword = user.password;
            let isMatch = false;

            if (storedPassword.length === 60) { // bcrypt hashes are always 60 chars
                isMatch = await bcrypt.compare(password, storedPassword);
            } else {
                isMatch = password === storedPassword;
            }

            if (!isMatch) {
                return res.status(401).send('Invalid username or password.');
            }

            // Store user session (now including 'name')
            req.session.user = {
                id: user.id,
                username: user.username,
                name: user.name,  // ✅ Include name here
                role: user.role
            };

            console.log("Login successful:", req.session.user);

            // Redirect based on role
            if (user.role === 1) {
                return res.redirect('/security-head/home'); 
            } else if (user.role ===2){
                return res.redirect('/it-admin/home');
            }
            else return res.status(403).send('Access denied.');

        } catch (err) {
            console.error('Login error:', err);
            return res.status(500).send('Internal Server Error');
        }
    });



 
    app.post('/logout', (req, res) => {
        // Destroy the session
        req.session.destroy((err) => {
            if (err) {
                console.error("Error during logout:", err);
                return res.status(500).send('Internal server error.');
            }

            // Redirect to login page or send a success message
            res.redirect('/'); // Adjust this based on your application
        });
    });



    app.get('/security-head/home', (req, res) => {
        if (!req.session.user || req.session.user.role !== 1) {
            console.log("Access denied: User not logged in or incorrect role");
            return res.status(403).send('Access denied.');
        }

        const { name } = req.session.user;
        res.render('sh-home', {
            name,
            newIncidents: 5, // Example dynamic data
            pendingActions: 3,
            thresholdAlerts: 2,
            recentUpdates: [
                { id: 1, description: 'Incident 1 details', created_at: new Date() },
                { id: 2, description: 'Incident 2 details', created_at: new Date() },
            ],
        });
    });

    app.get('/security-head/account', async (req, res) => {
        if (!req.session.user || req.session.user.role !== 1) {
            console.log("Access denied: User not logged in or incorrect role");
            return res.status(403).send('Access denied.');
        }

        const { role, name } = req.session.user; // Assuming `id` is stored in the session
        let profilePicture = '/images/default-profile.png'; // Default profile picture

        try {
            // Fetch the profile picture from the database
            const result = await pool.query('SELECT profile_picture FROM admin_users WHERE role = ?', [role]);

            if (result.length > 0 && result[0].profile_picture) {
                profilePicture = result[0].profile_picture; // Use the profile picture from the database
            }

            // Render the account page with dynamic data
            res.render('sh-account', {
                name,
                profilePicture
            });
        } catch (err) {
            console.error('Error fetching profile picture:', err);
            res.status(500).send('Internal Server Error');
        }
    });


    app.get('/security-head/incidents', (req, res) => {
        if (!req.session.user || req.session.user.role !== 1) {
            console.log("Access denied: User not logged in or incorrect role");
            return res.status(403).send('Access denied.');
        }

        const { name } = req.session.user;
        res.render('sh-incidents', {
            name,
            newIncidents: 5, // Example dynamic data
            pendingActions: 3,
            thresholdAlerts: 2,
            recentUpdates: [
                { id: 1, description: 'Incident 1 details', created_at: new Date() },
                { id: 2, description: 'Incident 2 details', created_at: new Date() },
            ],
        });
    });

    app.get('/security-head/reports', (req, res) => {
        if (!req.session.user || req.session.user.role !== 1) {
            console.log("Access denied: User not logged in or incorrect role");
            return res.status(403).send('Access denied.');
        }

        const { name } = req.session.user;
        res.render('sh-reports', {
            name
        });
    });

    app.get('/security-head/visualize', (req, res) => {
        if (!req.session.user || req.session.user.role !== 1) {
            console.log("Access denied: User not logged in or incorrect role");
            return res.status(403).send('Access denied.');
        }

        const { name } = req.session.user;
        res.render('sh-visualize', {
            name
        });
    });

    app.get('/security-head/notifications', (req, res) => {
        if (!req.session.user || req.session.user.role !== 1) {
            console.log("Access denied: User not logged in or incorrect role");
            return res.status(403).send('Access denied.');
        }

        const { name } = req.session.user;
        res.render('sh-notifications', {
            name
        });
    });
    app.post('/security-head/account/upload-picture', upload.single('profile_picture'), async (req, res) => {
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
    app.post('/security-head/account/update-profile', async (req, res) => {
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
    app.post('/security-head/account/update-password', async (req, res) => {
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

app.get('/it-admin/home', (req, res) => {
    if (!req.session.user || req.session.user.role !== 2) {
        console.log("Access denied: User not logged in or incorrect role");
        return res.status(403).send('Access denied.');
    }

    const { adminName,profileIcon } = req.session.user;
    res.render('it-home', {
        adminName,
        departmentsMonitored: 5, 
        profileIcon,// Example dynamic data
        systemHealth: "Good",
        activeUsers: 20,
        active:'home'
    });
});

// IT Admin Account Page
app.get('/it-admin/account', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 2) {
        console.log("Access denied: User not logged in or incorrect role");
        return res.status(403).send('Access denied.');
    }

    const { role, name } = req.session.user;
    let profilePicture = '/images/default-profile.png';

    try {
        const result = await pool.query('SELECT profile_picture FROM admin_users WHERE role = ?', [role]);
        if (result.length > 0 && result[0].profile_picture) {
            profilePicture = result[0].profile_picture;
        }
        res.render('it-account', { user: {name, profilePicture,active:'account' }});
    } catch (err) {
        console.error('Error fetching profile picture:', err);
        res.status(500).send('Internal Server Error');
    }
});

// IT Admin Reports Page
app.get('/it-admin/reports', (req, res) => {
    if (!req.session.user || req.session.user.role !== 2) {
        console.log("Access denied: User not logged in or incorrect role");
        return res.status(403).send('Access denied.');
    }
    const { name } = req.session.user;
    res.render('it-admin/reports', { name });
});

// IT Admin Notifications Page
app.get('/it-admin/notifications', (req, res) => {
    if (!req.session.user || req.session.user.role !== 2) {
        console.log("Access denied: User not logged in or incorrect role");
        return res.status(403).send('Access denied.');
    }
    const { name } = req.session.user;
    res.render('it-admin/notifications', { name });
});

// IT Admin Update Profile
app.post('/it-admin/account/update-profile', async (req, res) => {
    const { name } = req.body;
    const role = req.session.user.role;
    if (!name.trim()) {
        return res.status(400).send('Name cannot be empty.');
    }
    try {
        const result = await pool.query('UPDATE admin_users SET name = ? WHERE role = ?', [name, role]);
        if (result.affectedRows > 0) {
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
app.get('/it-admin/department', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 2) {
        console.log("Access denied: User not logged in or incorrect role");
        return res.status(403).send('Access denied.');
    }

    const { name } = req.session.user;
    let profileIcon = '👤';

    try {
        // Fetch profile picture
        const result = await pool.query('SELECT profile_picture FROM admin_users WHERE name = ?', [name]);
        if (result.length > 0 && result[0].profile_picture) {
            profileIcon = result[0].profile_picture;
        }

        // Fetch departments from the database
        const departmentsData = await pool.query('SELECT * FROM departments');
        const departments = departmentsData.length > 0 ? departmentsData : [];

        // Render page with data
        res.render('it-department', { adminName: name, profileIcon, departments, active: 'department' });

    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).send('Internal Server Error');
    }
});

<!-- Dashboard Widgets -->
<!-- <div class="dashboard-widgets">
    <div class="widget">
        <h3>Reported Incidents</h3>
        <p><%= reportedIncidents %></p>
    </div>
    <div class="widget">
        <h3>Pending Actions</h3>
        <p><%= pendingActions %></p>
    </div>
    <div class="widget">
        <h3>Notifications</h3>
        <p><%= notifications %></p>
    </div>
</div> -->

<!-- <% if (notifications.length > 0) { %>
    <ul class="notification-list">
        <% notifications.forEach(notification => { %>
            <li class="notification-item">
                <p><%= notification.message %></p>
                <span class="time"><%= notification.time %></span>
            </li>
        <% }); %>
    </ul>
<% } else { %>
    <p class="empty-message">No new notifications.</p>
<% } %> -->