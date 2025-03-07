document.addEventListener('DOMContentLoaded', function () {
    const adminToggle = document.getElementById('adminToggle');
    const departmentToggle = document.getElementById('departmentToggle');
    const loginTypeInput = document.getElementById('loginType');
    const loginForm = document.getElementById('loginForm');
    const usernameField = document.getElementById('username');
    const departmentIDField = document.getElementById('departmentID');
    const passwordField = document.getElementById('password');

    // Toggle between admin and department login
    adminToggle.addEventListener('click', () => {
        adminToggle.classList.add('active');
        departmentToggle.classList.remove('active');
        loginTypeInput.value = 'admin';

        // Enable username, disable department ID
        usernameField.disabled = false;
        usernameField.required = true;
        departmentIDField.disabled = true;
        departmentIDField.required = false;
        departmentIDField.value = ''; // Clear input
    });

    departmentToggle.addEventListener('click', () => {
        departmentToggle.classList.add('active');
        adminToggle.classList.remove('active');
        loginTypeInput.value = 'department';

        // Enable department ID, disable username
        departmentIDField.disabled = false;
        departmentIDField.required = true;
        usernameField.disabled = true;
        usernameField.required = false;
        usernameField.value = ''; // Clear input
    });

    // Handle login form submission
    loginForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        const loginType = loginTypeInput.value;
        const password = passwordField.value;

        let loginData = { password, loginType };

        if (loginType === 'admin') {
            loginData.username = usernameField.value.trim();
            if (!loginData.username) {
                alert('Username is required for Admin login.');
                return;
            }
        } else {
            loginData.departmentID = departmentIDField.value.trim();
            if (!loginData.departmentID) {
                alert('Department ID is required for Department login.');
                return;
            }
        }

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(loginData),
            });

            const result = await response.json();
            if (response.ok) {
                alert(result.message);
                window.location.href = result.redirect || '/dashboard'; // Redirect if provided
            } else {
                alert(result.error);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to login. Please try again.');
        }
    });
});
