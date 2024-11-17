// database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Define the path to the database file in the 'src/data' directory
const dbPath = path.join(__dirname, 'data', 'database.sqlite');

// Ensure the directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Create the database connection
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS registrations (
        channel_id TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        webhook_url TEXT NOT NULL,
        creator_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        guildname TEXT NOT NULL
    )`, (err) => {
        if (err) {
            console.error('Error creating table:', err.message);
        } else {
            console.log('Table "registrations" is ready.');
        }
    });
});

module.exports = db;