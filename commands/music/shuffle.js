const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("shuffle")
        .setDescription("Randomly shuffle the current queue."),

    async execute(interaction) {
        const queue = interaction.client.distube.getQueue(interaction.guildId);

        if (!queue) {
            return interaction.reply({
                content: "There is no queue to shuffle.",
                flags: 64
            });
        }

        queue.shuffle();

        await interaction.reply("Queue shuffled.");
    }
};