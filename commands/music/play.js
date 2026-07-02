const { SlashCommandBuilder } = require("discord.js");
const { formatTrack } = require("../../utils/musicHelpers");

function normalizeQuery(input) {
    let query = input.trim();

    query = query
        .replace(/^\/play\s+/i, "")
        .replace(/^song:\s*/i, "")
        .trim();

    query = query.replace(
        "https://music.youtube.com/",
        "https://www.youtube.com/"
    );

    return query;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Play a song from YouTube, Spotify, or a search term.")
        .addStringOption(option =>
            option
                .setName("song")
                .setDescription("Song name or URL.")
                .setRequired(true)
        ),

    async execute(interaction) {
  const rawQuery = interaction.options.getString("song");
let query = normalizeQuery(rawQuery);

const isUrl = /^https?:\/\//i.test(query);

if (!isUrl) {
    query = `scsearch:${query}`;
}
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({
                content: "Join a voice channel first.",
                flags: 64
            });
        }

        await interaction.deferReply();

        try {
            const player = interaction.client.lavalink.createPlayer({
                guildId: interaction.guildId,
                voiceChannelId: voiceChannel.id,
                textChannelId: interaction.channelId,
                selfDeaf: true
            });

            await player.connect();

            console.log("Lavalink search query:", query);

const result = await player.search(
    {
        query
    },
    interaction.user
);

            console.log("Lavalink load result:", {
                loadType: result?.loadType,
                trackCount: result?.tracks?.length || 0
            });

            if (!result || !result.tracks || result.tracks.length === 0) {
                return interaction.editReply(
                    "No results found. Try a normal `www.youtube.com/watch?v=...` link or a plain song name."
                );
            }

            if (result.loadType === "playlist") {
                player.queue.add(result.tracks);

                await interaction.editReply(
                    `Added playlist with **${result.tracks.length}** tracks.`
                );
            } else {
                const track = result.tracks[0];

                player.queue.add(track);

                await interaction.editReply(
                    `Added: ${formatTrack(track)}`
                );
            }

            if (!player.playing && !player.paused) {
                await player.play();
            }
        } catch (error) {
            console.error("Play command Lavalink error:", error);

            await interaction.editReply(
                `Music failed: \`${error.message || error}\``
            ).catch(console.error);
        }
    }
};