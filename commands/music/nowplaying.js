const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("nowplaying")
        .setDescription("Display the currently playing song."),

    async execute(interaction) {
        const queue = interaction.client.distube.getQueue(interaction.guildId);

        if (!queue || !queue.songs.length) {
            return interaction.reply({
                content: "There is no song playing.",
                flags: 64
            });
        }

        const song = queue.songs[0];

        await interaction.reply(
            `Now playing: **${song.name}** - \`${song.formattedDuration}\`\n${song.url}`
        );
    }
};