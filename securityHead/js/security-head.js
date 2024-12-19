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

// // Select all menu items and the content area
// const menuItems = document.querySelectorAll(".menu-item");
// const contentArea = document.getElementById("content-area");

// // Content for each menu item (placeholders)
// const menuContent = {
//     home: `
//         <h2>Home</h2>
//         <p>Welcome to the Security Management System. Use the menu on the left to navigate through your options.</p>
//     `,
//     visualise: `
//         <h2>Visualise</h2>
//         <p>Visualise key performance indicators and incident trends here.</p>
//     `,
//     reports: `
//         <h2>Reports</h2>
//         <p>View and manage incident reports submitted by various departments.</p>
//     `,
//     incidents: `
//         <h2>Incidents</h2>
//         <p>Log and investigate incidents reported by departments.</p>
//     `,
//     notifications: `
//         <h2>Notifications</h2>
//         <p>View important alerts and updates from the system.</p>
//     `,
//     account: `
//         <h2>Account</h2>
//         <p>Manage your account settings and preferences.</p>
//     `
// };

// // Add click event listener to each menu item
// menuItems.forEach((menuItem) => {
//     menuItem.addEventListener("click", (event) => {
//         event.preventDefault();

//         // Remove "active" class from all menu items
//         menuItems.forEach((item) => item.classList.remove("active"));

//         // Add "active" class to the clicked menu item
//         menuItem.classList.add("active");

//         // Get the content associated with the menu item
//         const contentKey = menuItem.getAttribute("data-content");
//         contentArea.innerHTML = menuContent[contentKey] || "<h2>Content not available</h2>";
//     });
// });
