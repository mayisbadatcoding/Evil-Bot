const { SlashCommandBuilder } = require("discord.js");
const { getPlayer } = require("../../utils/musicHelpers");

module.exports = {
    data: new SlashCommandBuilder().setName("stop").setDescription("Stop playback and clear the queue."),

    async execute(interaction) {
        const player = getPlayer(interaction.client, interaction.guildId);
        if (!player) return interaction.reply({ content: "Nothing is playing.", flags: 64 });

        player.queue.tracks.splice(0);
        await player.destroy();
        await interaction.reply("Stopped playback and cleared the queue.");
    }
};