require('dotenv').config();
const mariadb = require('mariadb');
const mysql = require('mysql2/promise');


const pool = mysql.createPool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 3307,
    connectionLimit: 10 // Optional: Limits concurrent connections
});
module.exports = pool;
