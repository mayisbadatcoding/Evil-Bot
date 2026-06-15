function getPlayer(client, guildId) {
    return client.lavalink.players.get(guildId);
}

function formatTrack(track, index = null) {
    const title = track?.info?.title || "Unknown title";
    const author = track?.info?.author || "Unknown artist";
    const duration = track?.info?.isStream
        ? "LIVE"
        : formatMs(track?.info?.duration || 0);

    return `${index !== null ? `${index}. ` : ""}**${title}** by **${author}** - \`${duration}\``;
}

function formatMs(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function parseTime(time) {
    const parts = time.split(":").map(Number);

    if (parts.some(Number.isNaN)) return null;

    if (parts.length === 1) return parts[0] * 1000;
    if (parts.length === 2) return ((parts[0] * 60) + parts[1]) * 1000;
    if (parts.length === 3) return ((parts[0] * 3600) + (parts[1] * 60) + parts[2]) * 1000;

    return null;
}

module.exports = {
    getPlayer,
    formatTrack,
    formatMs,
    parseTime
};