const { SlashCommandBuilder } = require("discord.js");

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
        const query = interaction.options.getString("song").trim();
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({
                content: "You need to be in a voice channel first.",
                flags: 64
            });
        }

        await interaction.deferReply();

        try {
            await interaction.client.distube.play(voiceChannel, query, {
                textChannel: interaction.channel,
                member: interaction.member
            });

            await interaction.editReply(`Searching/playing: **${query}**`);
        } catch (error) {
            console.error("Play command error:", error);

            await interaction.editReply(
                "I could not play that. Try a normal YouTube link or a plain song name instead."
            );
        }
    }
};