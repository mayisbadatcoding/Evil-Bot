const { SlashCommandBuilder } = require("discord.js");
const { getPlayer } = require("../../utils/musicHelpers");

module.exports = {
    data: new SlashCommandBuilder().setName("bassboost").setDescription("Toggle bass boost."),

    async execute(interaction) {
        const player = getPlayer(interaction.client, interaction.guildId);
        if (!player) return interaction.reply({ content: "Nothing is playing.", flags: 64 });

        await player.filterManager.setEqualizer([
            { band: 0, gain: 0.25 },
            { band: 1, gain: 0.20 },
            { band: 2, gain: 0.15 }
        ]);

        await interaction.reply("Bass boost enabled.");
    }
};