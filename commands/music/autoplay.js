const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("autoplay")
        .setDescription("Toggle autoplay for related songs."),

    async execute(interaction) {
        const queue = interaction.client.distube.getQueue(interaction.guildId);

        if (!queue) {
            return interaction.reply({
                content: "There is no queue.",
                flags: 64
            });
        }

        const enabled = queue.toggleAutoplay();

        await interaction.reply(`Autoplay is now **${enabled ? "enabled" : "disabled"}**.`);
    }
};