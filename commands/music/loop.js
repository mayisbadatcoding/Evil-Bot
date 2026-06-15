const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("loop")
        .setDescription("Loop the currently playing song."),

    async execute(interaction) {
        const queue = interaction.client.distube.getQueue(interaction.guildId);

        if (!queue) {
            return interaction.reply({
                content: "There is no music playing.",
                flags: 64
            });
        }

        queue.setRepeatMode(1);

        await interaction.reply("Looping the current song.");
    }
};