document.addEventListener('DOMContentLoaded', function () {
    const adminToggle = document.getElementById('adminToggle');
    const departmentToggle = document.getElementById('departmentToggle');
    const loginTypeInput = document.getElementById('loginType');

    // Toggle between Admin and Department Login
    adminToggle.addEventListener('click', () => {
        adminToggle.classList.add('active');
        departmentToggle.classList.remove('active');
        loginTypeInput.value = 'admin';
    });

    departmentToggle.addEventListener('click', () => {
        departmentToggle.classList.add('active');
        adminToggle.classList.remove('active');
        loginTypeInput.value = 'department';
    });

    // Handle login form submission
    document.getElementById('loginForm').addEventListener('submit', function (event) {
        event.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const loginType = loginTypeInput.value;

        if (username && password) {
            alert(`Logged in as ${loginType} with username: ${username}`);
            // Placeholder for backend integration
        } else {
            alert('Please fill out all fields');
        }
    });
});
