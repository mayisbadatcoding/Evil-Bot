const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("queue")
        .setDescription("View the current music queue."),

    async execute(interaction) {
        const queue = interaction.client.distube.getQueue(interaction.guildId);

        if (!queue || !queue.songs.length) {
            return interaction.reply({
                content: "The queue is empty.",
                flags: 64
            });
        }

        const songs = queue.songs
            .slice(0, 10)
            .map((song, index) =>
                `${index + 1}. **${song.name}** - \`${song.formattedDuration}\``
            )
            .join("\n");

        await interaction.reply({
            content: `Current Queue:\n${songs}`
        });
    }
};