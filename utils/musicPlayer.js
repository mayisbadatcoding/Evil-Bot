const { DisTube } = require("distube");
const { SpotifyPlugin } = require("@distube/spotify");
const { YouTubePlugin } = require("@distube/youtube");
const ffmpegPath = require("ffmpeg-static");

function parseYouTubeCookies(cookieString) {
    if (!cookieString) return undefined;

    return cookieString
        .split(";")
        .map(cookie => {
            const [name, ...valueParts] = cookie.trim().split("=");

            return {
                name,
                value: valueParts.join("="),
                domain: ".youtube.com",
                path: "/"
            };
        })
        .filter(cookie => cookie.name && cookie.value);
}

function setupMusicPlayer(client) {
    const youtubeCookies = parseYouTubeCookies(process.env.YOUTUBE_COOKIE);

    client.distube = new DisTube(client, {
        emitNewSongOnly: true,
        emitAddSongWhenCreatingQueue: true,
        savePreviousSongs: true,
        ffmpeg: {
            path: ffmpegPath
        },
        plugins: [
            new YouTubePlugin({
                cookies: youtubeCookies
            }),
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
    console.log(
        youtubeCookies
            ? `YouTube cookies loaded: ${youtubeCookies.length}`
            : "No YouTube cookies loaded."
    );
}

module.exports = {
    setupMusicPlayer
};