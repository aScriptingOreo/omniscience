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

// Define schemas as field:type pairs
const databaseSchemas = {
    registrations: {
        channel_id: { type: 'TEXT', primary: true },
        password: { type: 'TEXT', nullable: false },
        webhook_url: { type: 'TEXT', nullable: false },
        creator_id: { type: 'TEXT', nullable: false },
        timestamp: { type: 'TEXT', nullable: false },
        guildname: { type: 'TEXT', nullable: false }
    },
    voice_callers: {
        user_id: { type: 'TEXT', nullable: false },
        channel_id: { type: 'TEXT', nullable: false, foreignKey: 'voice_channels(channel_id)' },
        added_by: { type: 'TEXT', nullable: false },
        timestamp: { type: 'TEXT', nullable: false },
        constraints: ['PRIMARY KEY (user_id, channel_id)']
    },
    voice_channels: {
        channel_id: { type: 'TEXT', primary: true },
        guild_id: { type: 'TEXT', nullable: false },
        password: { type: 'TEXT', nullable: false },
        creator_id: { type: 'TEXT', nullable: false },
        timestamp: { type: 'TEXT', nullable: false }
    },
    settings: {
        guild_id: { type: 'TEXT', nullable: false },
        function: { type: 'TEXT', nullable: false },
        data: { type: 'TEXT', nullable: false },
        timestamp: { type: 'TEXT', nullable: false },
        constraints: ['PRIMARY KEY (guild_id, function)']
    }
};

// Helper function to generate CREATE TABLE statements
function generateCreateTableSQL(tableName, schema) {
    const fields = [];
    const constraints = [];

    for (const [fieldName, fieldDef] of Object.entries(schema)) {
        if (fieldName === 'constraints') continue;
        
        let fieldStr = `${fieldName} ${fieldDef.type}`;
        if (fieldDef.primary) fieldStr += ' PRIMARY KEY';
        if (!fieldDef.nullable) fieldStr += ' NOT NULL';
        if (fieldDef.foreignKey) {
            constraints.push(`FOREIGN KEY (${fieldName}) REFERENCES ${fieldDef.foreignKey} ON DELETE CASCADE`);
        }
        fields.push(fieldStr);
    }

    if (schema.constraints) {
        fields.push(...schema.constraints);
    }

    return `CREATE TABLE IF NOT EXISTS ${tableName} (${fields.join(', ')})`;
}

// Create the database connection
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        
        // Initialize database schema
        db.serialize(async () => {
            db.run('PRAGMA foreign_keys = ON');

            for (const [tableName, schema] of Object.entries(databaseSchemas)) {
                try {
                    const createTableSQL = generateCreateTableSQL(tableName, schema);
                    await new Promise((resolve, reject) => {
                        db.run(createTableSQL, (err) => {
                            if (err) {
                                console.error(`Error creating table ${tableName}:`, err);
                                reject(err);
                            } else {
                                console.log(`Table ${tableName} is ready`);
                                resolve();
                            }
                        });
                    });
                } catch (error) {
                    console.error(`Failed to initialize table ${tableName}:`, error);
                }
            }
        });
    }
});

// Database interface
const database = {
    // Query methods
    all: (query, params = []) => new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows));
    }),
    get: (query, params = []) => new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => err ? reject(err) : resolve(row));
    }),
    run: (query, params = []) => new Promise((resolve, reject) => {
        db.run(query, params, (err) => err ? reject(err) : resolve());
    }),

    // Schema access
    schemas: databaseSchemas,

    // Raw database access (for advanced usage)
    raw: db
};

// Export the database interface
module.exports = database;