const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS points (
            user_id TEXT PRIMARY KEY,
            points INTEGER NOT NULL DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS funny_command_logs (
            id SERIAL PRIMARY KEY,
            command_name TEXT NOT NULL,
            user_id TEXT NOT NULL,
            username TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS warnings (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            moderator_id TEXT NOT NULL,
            reason TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

async function getPoints(userId) {
    const result = await pool.query(
        "SELECT points FROM points WHERE user_id = $1",
        [userId]
    );

    return result.rows[0]?.points || 0;
}

async function addPoints(userId, amount) {
    const currentPoints = await getPoints(userId);
    const newPoints = currentPoints + amount;

    await pool.query(
        `
        INSERT INTO points (user_id, points, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id)
        DO UPDATE SET
            points = $2,
            updated_at = CURRENT_TIMESTAMP;
        `,
        [userId, newPoints]
    );

    return newPoints;
}

async function removePoints(userId, amount) {
    const currentPoints = await getPoints(userId);
    const newPoints = currentPoints - amount;

    await pool.query(
        `
        INSERT INTO points (user_id, points, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id)
        DO UPDATE SET
            points = $2,
            updated_at = CURRENT_TIMESTAMP;
        `,
        [userId, newPoints]
    );

    return newPoints;
}

async function logFunnyCommand(commandName, user) {
    await pool.query(
        `
        INSERT INTO funny_command_logs (command_name, user_id, username)
        VALUES ($1, $2, $3);
        `,
        [commandName, user.id, user.tag]
    );
}

async function addWarning(userId, moderatorId, reason) {
    const result = await pool.query(
        `
        INSERT INTO warnings (user_id, moderator_id, reason)
        VALUES ($1, $2, $3)
        RETURNING id, user_id, moderator_id, reason, created_at;
        `,
        [userId, moderatorId, reason]
    );

    return result.rows[0];
}

async function getWarnings(userId) {
    const result = await pool.query(
        `
        SELECT id, user_id, moderator_id, reason, created_at
        FROM warnings
        WHERE user_id = $1
        ORDER BY created_at DESC;
        `,
        [userId]
    );

    return result.rows;
}

async function clearWarnings(userId) {
    const result = await pool.query(
        `
        DELETE FROM warnings
        WHERE user_id = $1
        RETURNING id;
        `,
        [userId]
    );

    return result.rowCount;
}

module.exports = {
    initDatabase,
    getPoints,
    addPoints,
    removePoints,
    logFunnyCommand,
    addWarning,
    getWarnings,
    clearWarnings
};