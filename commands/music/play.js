const { SlashCommandBuilder } = require("discord.js");
const { formatTrack } = require("../../utils/musicHelpers");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Play a song from YouTube, Spotify, or a search term.")
        .addStringOption(option =>
            option.setName("song").setDescription("Song name or URL.").setRequired(true)
        ),

    async execute(interaction) {
        const query = interaction.options.getString("song").trim();
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: "Join a voice channel first.", flags: 64 });
        }

        await interaction.deferReply();

        const player = interaction.client.lavalink.createPlayer({
            guildId: interaction.guildId,
            voiceChannelId: voiceChannel.id,
            textChannelId: interaction.channelId,
            selfDeaf: true
        });

        await player.connect();

        const result = await player.search({ query }, interaction.user);

        if (!result || !result.tracks || result.tracks.length === 0) {
            return interaction.editReply("No results found.");
        }

        if (result.loadType === "playlist") {
            player.queue.add(result.tracks);
            await interaction.editReply(`Added playlist with **${result.tracks.length}** tracks.`);
        } else {
            const track = result.tracks[0];
            player.queue.add(track);
            await interaction.editReply(`Added: ${formatTrack(track)}`);
        }

        if (!player.playing && !player.paused) {
            await player.play();
        }
    }
};