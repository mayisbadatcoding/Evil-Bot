const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS oauth_states (
            state TEXT PRIMARY KEY,
            discord_user_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS bot_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_logs (
        id SERIAL PRIMARY KEY,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS custom_roles (
            user_id TEXT PRIMARY KEY,
            username TEXT,
            role_id TEXT NOT NULL,
            role_name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        ALTER TABLE custom_roles
        ADD COLUMN IF NOT EXISTS username TEXT;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS custom_role_blacklist (
            user_id TEXT PRIMARY KEY,
            username TEXT,
            blacklisted_by TEXT NOT NULL,
            blacklisted_by_username TEXT,
            reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        ALTER TABLE custom_role_blacklist
        ADD COLUMN IF NOT EXISTS username TEXT;
    `);

    await pool.query(`
        ALTER TABLE custom_role_blacklist
        ADD COLUMN IF NOT EXISTS blacklisted_by_username TEXT;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS roblox_links (
            discord_user_id TEXT PRIMARY KEY,
            discord_username TEXT,
            roblox_user_id TEXT NOT NULL,
            roblox_username TEXT NOT NULL,
            linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        ALTER TABLE roblox_links
        ADD COLUMN IF NOT EXISTS discord_username TEXT;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS points (
            user_id TEXT PRIMARY KEY,
            username TEXT,
            points INTEGER NOT NULL DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        ALTER TABLE points
        ADD COLUMN IF NOT EXISTS username TEXT;
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
        ALTER TABLE funny_command_logs
        ADD COLUMN IF NOT EXISTS username TEXT;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS warnings (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            username TEXT,
            moderator_id TEXT NOT NULL,
            moderator_username TEXT,
            reason TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        ALTER TABLE warnings
        ADD COLUMN IF NOT EXISTS username TEXT;
    `);

    await pool.query(`
        ALTER TABLE warnings
        ADD COLUMN IF NOT EXISTS moderator_username TEXT;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS bug_report_bans (
            user_id TEXT PRIMARY KEY,
            username TEXT,
            banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        ALTER TABLE bug_report_bans
        ADD COLUMN IF NOT EXISTS username TEXT;
    `);
}

async function getPoints(userId) {
    const result = await pool.query(
        "SELECT points FROM points WHERE user_id = $1",
        [userId]
    );

    return result.rows[0]?.points || 0;
}

async function addPoints(userId, username, amount) {
    const currentPoints = await getPoints(userId);
    const newPoints = currentPoints + amount;

    await pool.query(
        `
        INSERT INTO points (user_id, username, points, updated_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id)
        DO UPDATE SET
            username = $2,
            points = $3,
            updated_at = CURRENT_TIMESTAMP;
        `,
        [userId, username, newPoints]
    );

    return newPoints;
}

async function removePoints(userId, username, amount) {
    const currentPoints = await getPoints(userId);
    const newPoints = currentPoints - amount;

    await pool.query(
        `
        INSERT INTO points (user_id, username, points, updated_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id)
        DO UPDATE SET
            username = $2,
            points = $3,
            updated_at = CURRENT_TIMESTAMP;
        `,
        [userId, username, newPoints]
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

async function addWarning(userId, username, moderatorId, moderatorUsername, reason) {
    const result = await pool.query(
        `
        INSERT INTO warnings (user_id, username, moderator_id, moderator_username, reason)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, user_id, username, moderator_id, moderator_username, reason, created_at;
        `,
        [userId, username, moderatorId, moderatorUsername, reason]
    );

    return result.rows[0];
}

async function getWarnings(userId) {
    const result = await pool.query(
        `
        SELECT id, user_id, username, moderator_id, moderator_username, reason, created_at
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

async function isBugReportBanned(userId) {
    const result = await pool.query(
        "SELECT user_id FROM bug_report_bans WHERE user_id = $1",
        [userId]
    );

    return result.rows.length > 0;
}

async function banBugReporter(userId, username = null) {
    await pool.query(
        `
        INSERT INTO bug_report_bans (user_id, username)
        VALUES ($1, $2)
        ON CONFLICT (user_id)
        DO UPDATE SET username = $2;
        `,
        [userId, username]
    );
}

async function saveOAuthState(state, discordUserId, guildId) {
    await pool.query(
        `
        INSERT INTO oauth_states (state, discord_user_id, guild_id)
        VALUES ($1, $2, $3);
        `,
        [state, discordUserId, guildId]
    );
}

async function getOAuthState(state) {
    const result = await pool.query(
        `
        SELECT state, discord_user_id, guild_id
        FROM oauth_states
        WHERE state = $1;
        `,
        [state]
    );

    return result.rows[0] || null;
}

async function deleteOAuthState(state) {
    await pool.query(
        "DELETE FROM oauth_states WHERE state = $1;",
        [state]
    );
}

async function linkRobloxAccount(discordUserId, discordUsername, robloxUserId, robloxUsername) {
    await pool.query(
        `
        INSERT INTO roblox_links (discord_user_id, discord_username, roblox_user_id, roblox_username, linked_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (discord_user_id)
        DO UPDATE SET
            discord_username = $2,
            roblox_user_id = $3,
            roblox_username = $4,
            linked_at = CURRENT_TIMESTAMP;
        `,
        [discordUserId, discordUsername, robloxUserId, robloxUsername]
    );
}

async function getSetting(key, defaultValue = null) {
    const result = await pool.query(
        "SELECT value FROM bot_settings WHERE key = $1",
        [key]
    );

    return result.rows[0]?.value ?? defaultValue;
}

async function setSetting(key, value) {
    await pool.query(
        `
        INSERT INTO bot_settings (key, value)
        VALUES ($1, $2)
        ON CONFLICT (key)
        DO UPDATE SET value = $2;
        `,
        [key, value]
    );
}

async function isPreReleaseEnabled() {
    const value = await getSetting("pre_release_enabled", "true");
    return value === "true";
}

async function setPreReleaseEnabled(enabled) {
    await setSetting("pre_release_enabled", enabled ? "true" : "false");
}

async function getCustomRole(userId) {
    const result = await pool.query(
        `
        SELECT user_id, username, role_id, role_name
        FROM custom_roles
        WHERE user_id = $1;
        `,
        [userId]
    );

    return result.rows[0] || null;
}

async function saveCustomRole(userId, username, roleId, roleName) {
    await pool.query(
        `
        INSERT INTO custom_roles (user_id, username, role_id, role_name)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id)
        DO UPDATE SET
            username = $2,
            role_id = $3,
            role_name = $4;
        `,
        [userId, username, roleId, roleName]
    );
}

async function deleteCustomRole(userId) {
    await pool.query(
        "DELETE FROM custom_roles WHERE user_id = $1",
        [userId]
    );
}

async function isCustomRoleBlacklisted(userId) {
    const result = await pool.query(
        "SELECT user_id FROM custom_role_blacklist WHERE user_id = $1",
        [userId]
    );

    return result.rows.length > 0;
}

async function blacklistCustomRoleUser(userId, username, moderatorId, moderatorUsername, reason) {
    await pool.query(
        `
        INSERT INTO custom_role_blacklist (user_id, username, blacklisted_by, blacklisted_by_username, reason)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id)
        DO UPDATE SET
            username = $2,
            blacklisted_by = $3,
            blacklisted_by_username = $4,
            reason = $5;
        `,
        [userId, username, moderatorId, moderatorUsername, reason]
    );
}

async function unblacklistCustomRoleUser(userId) {
    await pool.query(
        "DELETE FROM custom_role_blacklist WHERE user_id = $1",
        [userId]
    );
}
async function saveBotLog(level, message) {
    await pool.query(
        `
        INSERT INTO bot_logs (level, message)
        VALUES ($1, $2);
        `,
        [level, String(message).slice(0, 4000)]
    ).catch(() => {});
}

async function getRecentBotLogs(minutes = 5) {
    const result = await pool.query(
        `
        SELECT level, message, created_at
        FROM bot_logs
        WHERE created_at >= NOW() - ($1 || ' minutes')::INTERVAL
        ORDER BY created_at ASC;
        `,
        [minutes]
    );

    return result.rows;
}

module.exports = {
    initDatabase,

    getPoints,
    addPoints,
    removePoints,

    logFunnyCommand,

    addWarning,
    getWarnings,
    clearWarnings,

    isBugReportBanned,
    banBugReporter,

    saveOAuthState,
    getOAuthState,
    deleteOAuthState,
    linkRobloxAccount,

    getSetting,
    setSetting,
    isPreReleaseEnabled,
    setPreReleaseEnabled,

    getCustomRole,
    saveCustomRole,
    deleteCustomRole,
    isCustomRoleBlacklisted,
    blacklistCustomRoleUser,
    unblacklistCustomRoleUser,
    saveBotLog,
    getRecentBotLogs
};