const { SlashCommandBuilder } = require("discord.js");
const { getPlayer } = require("../../utils/musicHelpers");

module.exports = {
    data: new SlashCommandBuilder().setName("nightcore").setDescription("Apply the Nightcore filter."),

    async execute(interaction) {
        const player = getPlayer(interaction.client, interaction.guildId);
        if (!player) return interaction.reply({ content: "Nothing is playing.", flags: 64 });

        await player.filterManager.setTimescale({
            speed: 1.15,
            pitch: 1.20,
            rate: 1.0
        });

        await interaction.reply("Nightcore enabled.");
    }
};