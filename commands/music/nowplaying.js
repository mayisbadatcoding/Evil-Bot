const { SlashCommandBuilder } = require("discord.js");
const { getPlayer, formatTrack } = require("../../utils/musicHelpers");

module.exports = {
    data: new SlashCommandBuilder().setName("nowplaying").setDescription("Show the current song."),

    async execute(interaction) {
        const player = getPlayer(interaction.client, interaction.guildId);

        if (!player || !player.queue.current) {
            return interaction.reply({ content: "Nothing is playing.", flags: 64 });
        }

        await interaction.reply(`Now playing: ${formatTrack(player.queue.current)}`);
    }
};