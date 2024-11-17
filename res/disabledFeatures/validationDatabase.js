// src/utils/validationDatabase.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

// Establish a connection pool
const pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function logValidationRequest(issuerId, screenshotUrl, members, description, issuerUsername) {
    const [result] = await pool.execute(
        'INSERT INTO validation_requests (issuer_id, screenshot_url, members, descrição, issuer_username) VALUES (?, ?, ?, ?, ?)',
        [issuerId, screenshotUrl, members, description, issuerUsername]
    );
    return result.insertId;
}

async function updateValidationRequest(validationId, messageId, screenshotUrl) {
    await pool.execute(
        'UPDATE validation_requests SET message_id = ?, screenshot_url = ? WHERE id = ?',
        [messageId, screenshotUrl, validationId]
    );
}

async function getValidationRequest(validationId) {
    const [rows] = await pool.execute(
        'SELECT * FROM validation_requests WHERE id = ?',
        [validationId]
    );
    return rows[0];
}

async function logApproval(validationId, moraleValue, members, reason) {
    await pool.execute(
        'INSERT INTO validation_approvals (validation_id, morale_value, members, reason) VALUES (?, ?, ?, ?)',
        [validationId, moraleValue, members, reason]
    );
}

async function logDenial(validationId, members, description, denialReason) {
    await pool.execute(
        'INSERT INTO validation_denials (validation_id, members, descrição, denial_reason) VALUES (?, ?, ?, ?)',
        [validationId, members, description, denialReason]
    );
}

module.exports = { logValidationRequest, updateValidationRequest, getValidationRequest, logApproval, logDenial };