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
}

async function getPoints(userId) {
    const result = await pool.query(
        "SELECT points FROM points WHERE user_id = $1",
        [userId]
    );

    return result.rows[0]?.points || 0;
}

async function addPoints(userId, amount) {
    const result = await pool.query(
        `
        INSERT INTO points (user_id, points, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id)
        DO UPDATE SET
            points = points.points + EXCLUDED.points,
            updated_at = CURRENT_TIMESTAMP
        RETURNING points;
        `,
        [userId, amount]
    );

    return result.rows[0].points;
}

async function removePoints(userId, amount) {
    const result = await pool.query(
        `
        INSERT INTO points (user_id, points, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id)
        DO UPDATE SET
            points = points.points + EXCLUDED.points,
            updated_at = CURRENT_TIMESTAMP
        RETURNING points;
        `,
        [userId, -amount]
    );

    return result.rows[0].points;
}

module.exports = {
    initDatabase,
    getPoints,
    addPoints,
    removePoints
};