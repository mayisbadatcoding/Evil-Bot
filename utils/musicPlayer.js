const { DisTube } = require("distube");
const { SpotifyPlugin } = require("@distube/spotify");
const ffmpegPath = require("ffmpeg-static");

function setupMusicPlayer(client) {
    client.distube = new DisTube(client, {
        emitNewSongOnly: true,
        savePreviousSongs: true,
        ffmpeg: {
            path: ffmpegPath
        },
        plugins: [
            new SpotifyPlugin()
        ]
    });

    client.distube
        .on("playSong", (queue, song) => {
            queue.textChannel?.send(
                `Now playing: **${song.name}** - \`${song.formattedDuration}\``
            ).catch(() => {});
        })
        .on("addSong", (queue, song) => {
            queue.textChannel?.send(
                `Added to queue: **${song.name}** - \`${song.formattedDuration}\``
            ).catch(() => {});
        })
        .on("error", (channel, error) => {
            console.error("DisTube Error:", error);

            if (channel) {
                channel.send(`Music error: ${error.message}`).catch(() => {});
            }
        })
        .on("empty", queue => {
            queue.textChannel?.send("Voice channel is empty. Leaving.").catch(() => {});
        })
        .on("finish", queue => {
            queue.textChannel?.send("Queue finished.").catch(() => {});
        });

    console.log(`Music player loaded with FFmpeg: ${ffmpegPath}`);
}

module.exports = {
    setupMusicPlayer
};