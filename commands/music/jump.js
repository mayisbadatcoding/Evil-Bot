const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("jump")
        .setDescription("Jump to a specific song in the queue.")
        .addIntegerOption(option =>
            option
                .setName("position")
                .setDescription("Queue position to jump to.")
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

        await queue.jump(position - 1);

        await interaction.reply(`Jumped to queue position **${position}**.`);
    }
};