const mysql = require('mysql2/promise');
const config = require('./db-local.credentials.json');

const pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    dateStrings: true,
});

module.exports = pool;