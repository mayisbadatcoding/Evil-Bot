const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("loopqueue")
        .setDescription("Loop the entire queue."),

    async execute(interaction) {
        const queue = interaction.client.distube.getQueue(interaction.guildId);

        if (!queue) {
            return interaction.reply({
                content: "There is no queue playing.",
                flags: 64
            });
        }

        queue.setRepeatMode(2);

        await interaction.reply("Looping the entire queue.");
    }
};