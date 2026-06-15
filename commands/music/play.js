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
        const query = interaction.options.getString("song");
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({
                content: "You need to be in a voice channel first.",
                flags: 64
            });
        }

        await interaction.reply(`Searching for: **${query}**`);

        await interaction.client.distube.play(voiceChannel, query, {
            textChannel: interaction.channel,
            member: interaction.member
        });
    }
};