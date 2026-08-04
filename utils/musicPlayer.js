const { LavalinkManager } = require("lavalink-client");

function setupMusicPlayer(client) {
    client.lavalink = new LavalinkManager({
        nodes: [
            {
                id: "Evil-Lavalink",
                host: process.env.LAVALINK_HOST,
                port: Number(process.env.LAVALINK_PORT || 443),
                authorization: process.env.LAVALINK_PASSWORD,
                secure: process.env.LAVALINK_SECURE === "true"
            }
        ],

        sendToShard: (guildId, payload) => {
            const guild = client.guilds.cache.get(guildId);
            if (guild) guild.shard.send(payload);
        },

        autoSkip: true,

        client: {
            id: process.env.CLIENT_ID,
            username: "Evil Bot"
        },

        playerOptions: {
            defaultSearchPlatform: "ytsearch",
            onDisconnect: {
                autoReconnect: true,
                destroyPlayer: false
            },
            onEmptyQueue: {
                destroyAfterMs: 30000
            }
        }
    });

    client.on("raw", data => {
        client.lavalink.sendRawData(data);
    });

    client.lavalink.nodeManager.on("connect", node => {
        console.log(`Lavalink node connected: ${node.id}`);
    });

    client.lavalink.nodeManager.on("error", (node, error) => {
        console.error(`Lavalink node error on ${node.id}:`, error);
    });

    client.lavalink.on("trackStart", (player, track) => {
        const channel = client.channels.cache.get(player.textChannelId);
        channel?.send(`Now playing: **${track.info.title}**`).catch(() => {});
    });

    client.lavalink.on("queueEnd", player => {
        const channel = client.channels.cache.get(player.textChannelId);
        channel?.send("Queue finished.").catch(() => {});
    });

    console.log("Lavalink music player loaded.");
}

function initMusicPlayer(client) {
    client.lavalink.init({
        id: client.user.id,
        username: client.user.username
    });
}

module.exports = {
    setupMusicPlayer,
    initMusicPlayer
};