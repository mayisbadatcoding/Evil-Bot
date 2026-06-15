const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("remove")
        .setDescription("Remove a song from the queue.")
        .addIntegerOption(option =>
            option
                .setName("position")
                .setDescription("Queue position to remove.")
                .setRequired(true)
                .setMinValue(1)
        ),

    async execute(interaction) {
        const queue = interaction.client.distube.getQueue(interaction.guildId);

        if (!queue) {
            return interaction.reply({
                content: "There is no queue.",
                flags: 64
            });
        }

        const position = interaction.options.getInteger("position");

        if (position === 1) {
            return interaction.reply({
                content: "Use /skip to remove the currently playing song.",
                flags: 64
            });
        }

        const song = queue.songs[position - 1];

        if (!song) {
            return interaction.reply({
                content: "Invalid queue position.",
                flags: 64
            });
        }

        queue.songs.splice(position - 1, 1);

        await interaction.reply(`Removed **${song.name}** from the queue.`);
    }
};