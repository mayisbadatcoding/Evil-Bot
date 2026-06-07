const express = require("express");
const crypto = require("crypto");

const {
    saveOAuthState,
    getOAuthState,
    deleteOAuthState,
    linkRobloxAccount
} = require("./storage");

const {
    getUserRank,
    getDiscordRoleFromRank
} = require("./robloxVerify");

const ROBLOX_AUTHORIZE_URL = "https://apis.roblox.com/oauth/v1/authorize";
const ROBLOX_TOKEN_URL = "https://apis.roblox.com/oauth/v1/token";
const ROBLOX_USERINFO_URL = "https://apis.roblox.com/oauth/v1/userinfo";

function createVerifyUrl(discordUserId, guildId) {
    const state = crypto.randomBytes(32).toString("hex");

    saveOAuthState(state, discordUserId, guildId).catch(console.error);

    const params = new URLSearchParams({
        client_id: process.env.ROBLOX_CLIENT_ID,
        response_type: "code",
        redirect_uri: process.env.ROBLOX_REDIRECT_URI,
        scope: "openid profile",
        state
    });

    return `${ROBLOX_AUTHORIZE_URL}?${params.toString()}`;
}

function startOAuthServer(client) {
    const app = express();

    app.get("/", (req, res) => {
        res.send("Evil Bot OAuth server is online.");
    });

    app.get("/oauth/roblox/callback", async (req, res) => {
        try {
            const { code, state } = req.query;

            if (!code || !state) {
                return res.status(400).send("Missing code or state.");
            }

            const savedState = await getOAuthState(state);

            if (!savedState) {
                return res.status(400).send("Invalid or expired verification session.");
            }

            await deleteOAuthState(state);

            const tokenResponse = await fetch(ROBLOX_TOKEN_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    grant_type: "authorization_code",
                    code,
                    client_id: process.env.ROBLOX_CLIENT_ID,
                    client_secret: process.env.ROBLOX_CLIENT_SECRET,
                    redirect_uri: process.env.ROBLOX_REDIRECT_URI
                })
            });

            if (!tokenResponse.ok) {
                const text = await tokenResponse.text();
                console.error("Roblox token error:", text);
                return res.status(400).send("Failed to finish Roblox login.");
            }

            const tokenData = await tokenResponse.json();

            const userInfoResponse = await fetch(ROBLOX_USERINFO_URL, {
                headers: {
                    Authorization: `Bearer ${tokenData.access_token}`
                }
            });

            if (!userInfoResponse.ok) {
                const text = await userInfoResponse.text();
                console.error("Roblox userinfo error:", text);
                return res.status(400).send("Failed to fetch Roblox account.");
            }

            const robloxUser = await userInfoResponse.json();

            const robloxUserId = String(robloxUser.sub);
            const robloxUsername = robloxUser.preferred_username || robloxUser.name || "Unknown";

            await linkRobloxAccount(savedState.discord_user_id, robloxUserId, robloxUsername);

            const guild = await client.guilds.fetch(savedState.guild_id);
            const member = await guild.members.fetch(savedState.discord_user_id);

            const rank = await getUserRank(Number(robloxUserId));
            const roleId = getDiscordRoleFromRank(rank);

            if (!roleId) {
                await member.user.send(
                    `You linked Roblox account **${robloxUsername}**, but you do not have a supported group rank.`
                ).catch(() => {});

                return res.send("Roblox account linked, but no supported group rank was found. You can close this page.");
            }

            await member.roles.add(roleId);

            const currentNickname = member.nickname || member.user.username;

            if (!currentNickname.startsWith("Evil")) {
                await member.setNickname(`Evil${currentNickname}`).catch(console.error);
            }

            await member.user.send(
                `You verified with Roblox account **${robloxUsername}** and received your Discord role.`
            ).catch(() => {});

            const welcomeChannel = guild.channels.cache.get(process.env.WELCOME_CHANNEL_ID);

            if (welcomeChannel) {
                await welcomeChannel.send(
                    `Welcome ${member}! Verified as **${robloxUsername}**.`
                ).catch(console.error);
            }

            return res.send("Verification complete. You can close this page.");
        } catch (error) {
            console.error("OAuth callback error:", error);
            return res.status(500).send("Verification failed.");
        }
    });

    const port = process.env.PORT || 3000;

    app.listen(port, () => {
        console.log(`OAuth server running on port ${port}`);
    });
}

module.exports = {
    createVerifyUrl,
    startOAuthServer
};