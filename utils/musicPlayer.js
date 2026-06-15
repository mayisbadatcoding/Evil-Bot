const { DisTube } = require("distube");
const { SpotifyPlugin } = require("@distube/spotify");
const { YouTubePlugin } = require("@distube/youtube");
const ffmpegPath = require("ffmpeg-static");

function setupMusicPlayer(client) {
    client.distube = new DisTube(client, {
        emitNewSongOnly: true,
        emitAddSongWhenCreatingQueue: true,
        savePreviousSongs: true,
        ffmpeg: {
            path: ffmpegPath
        },
        plugins: [
            new YouTubePlugin(),
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

        .on("finishSong", (queue, song) => {
            queue.textChannel?.send(
                `Finished: **${song.name}**`
            ).catch(() => {});
        })

        .on("finish", queue => {
            queue.textChannel?.send("Queue finished.").catch(() => {});
        })

        .on("empty", queue => {
            queue.textChannel?.send("Voice channel is empty. Leaving.").catch(() => {});
        })

        .on("disconnect", queue => {
            queue.textChannel?.send("Disconnected from voice.").catch(() => {});
        })

        .on("error", (error, queue) => {
            console.error("REAL DISTUBE ERROR:", error);

            const channel = queue?.textChannel;

            if (channel) {
                channel.send(
                    `Music error: \`${error.message || error}\``
                ).catch(() => {});
            }
        });

    console.log(`Music player loaded with FFmpeg: ${ffmpegPath}`);
}

module.exports = {
    setupMusicPlayer
};