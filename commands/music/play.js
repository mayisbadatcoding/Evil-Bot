const { SlashCommandBuilder } = require("discord.js");

function cleanQuery(input) {
    return input
        .replace(/^\/play\s+/i, "")
        .replace(/^song:/i, "")
        .trim();
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
        const query = cleanQuery(rawQuery);
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({
                content: "You need to be in a voice channel first.",
                flags: 64
            });
        }

        await interaction.reply({
            content: `Loading: **${query}**`
        });

        try {
            await interaction.client.distube.play(voiceChannel, query, {
                textChannel: interaction.channel,
                member: interaction.member
            });
        } catch (error) {
            console.error("Play command error:", error);

            await interaction.followUp({
                content: "I could not play that. Try a plain song name or a normal YouTube watch link."
            }).catch(console.error);
        }
    }
};