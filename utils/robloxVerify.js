const noblox = require("noblox.js");

const GROUP_ID = Number(process.env.ROBLOX_GROUP_ID);

const RANK_TO_DISCORD_ROLE = {
    1: "1507960719851913268",
    253: "1507960823023407286",
    254: "1507960920180265114",
    255: "1507960993937096826"
};

let loggedIn = false;

async function loginRoblox() {
    if (loggedIn) return;

    await noblox.setCookie(process.env.ROBLOX_COOKIE);
    loggedIn = true;

    console.log("Roblox account logged in.");
}

async function getRobloxUserId(username) {
    return await noblox.getIdFromUsername(username);
}

async function getUserRank(userId) {
    return await noblox.getRankInGroup(GROUP_ID, userId);
}

function getDiscordRoleFromRank(rank) {
    return RANK_TO_DISCORD_ROLE[rank] || null;
}

async function getRobloxDescription(userId) {
    const info = await noblox.getPlayerInfo(userId);
    return info.blurb || "";
}

module.exports = {
    loginRoblox,
    getRobloxUserId,
    getUserRank,
    getDiscordRoleFromRank,
    getRobloxDescription
};