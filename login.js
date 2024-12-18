document.getElementById('loginForm').addEventListener('submit', function (event) {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (username && password) {
        // Placeholder for actual login logic
        alert('Login successful');
    } else {
        alert('Please fill out all fields');
    }
});
