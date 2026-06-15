const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("volume")
        .setDescription("Adjust the music volume.")
        .addIntegerOption(option =>
            option
                .setName("amount")
                .setDescription("Volume from 1 to 100.")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        ),

    async execute(interaction) {
        const queue = interaction.client.distube.getQueue(interaction.guildId);

        if (!queue) {
            return interaction.reply({
                content: "There is no music playing.",
                flags: 64
            });
        }

        const volume = interaction.options.getInteger("amount");

        queue.setVolume(volume);

        await interaction.reply(`Volume set to **${volume}%**.`);
    }
};