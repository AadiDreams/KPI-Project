const bcrypt = require('bcrypt');
const pool = require('../db'); // Ensure correct DB connection

(async () => {
    let conn;
    try {
        conn = await pool.getConnection();

        // 1️⃣ Fetch all departments
        const departments = await conn.query('SELECT departmentID, departmentName, password FROM departments');

        if (!Array.isArray(departments)) {
            throw new Error("Unexpected result: departments is not an array");
        }

        for (let department of departments) {
            if (!department.password.startsWith("$2b$")) { // Ensure it's not already hashed
                const hashedPassword = await bcrypt.hash(department.password, 10);
                
                // 2️⃣ Update the department's password
                await conn.query('UPDATE departments SET password = ? WHERE departmentID = ?', [hashedPassword, department.departmentID]);
                console.log(`✅ Hashed password for department: ${department.departmentName}`);
            } else {
                console.log(`⚠️ Department ${department.departmentName} already has a hashed password. Skipping...`);
            }
        }

        console.log("🚀 Department password hashing migration completed!");
    } catch (error) {
        console.error("❌ Error hashing department passwords:", error);
    } finally {
        if (conn) conn.release(); // Always release DB connection
        process.exit(0);
    }
})();
