// Function to fetch and populate the UID field when the form loads
document.addEventListener('DOMContentLoaded', function() {
    // Get the UID input field
    const uidField = document.getElementById('uid');
    
    if (uidField) {
        // Get department ID from the URL
        const pathParts = window.location.pathname.split('/');
        const departmentIndex = pathParts.indexOf('department');
        
        if (departmentIndex !== -1 && pathParts.length > departmentIndex + 1) {
            const departmentID = pathParts[departmentIndex + 1];
            
            console.log(`Fetching UID for department: ${departmentID}`);
            
            // Fetch the next UID from the server
            fetch(`/department/${departmentID}/next-uid`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        // Set the UID value and make it readonly
                        uidField.value = data.uid;
                        uidField.setAttribute('readonly', true);
                        console.log(`UID generated successfully: ${data.uid}`);
                    } else {
                        console.error('Error fetching UID:', data.error);
                        // Set a fallback UID with current date
                        const date = new Date();
                        const deptCode = departmentID.split('_')[1] || 'XX';
                        uidField.value = `IR/${deptCode}/001/${date.getFullYear()}`;
                    }
                })
                .catch(error => {
                    console.error('Network error when fetching UID:', error);
                    // Set a fallback UID with current date if fetch fails
                    const date = new Date();
                    const deptCode = departmentID.split('_')[1] || 'XX';
                    uidField.value = `IR/${deptCode}/001/${date.getFullYear()}`;
                });
        }
    }
});