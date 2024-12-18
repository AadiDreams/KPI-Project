document.addEventListener('DOMContentLoaded', function () {
    // Handle logout button
    const logoutButton = document.querySelector('.logout');
    logoutButton.addEventListener('click', () => {
        alert('Logging out...');
        // Add backend logout logic here
    });

    // Handle notification click
    const notification = document.querySelector('.notification');
    notification.addEventListener('click', () => {
        alert('No new notifications at the moment.');
        // Fetch notifications from backend here
    });
});
