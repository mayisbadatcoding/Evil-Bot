const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("clanker")
        .setDescription("Shows the worst clankers in the server."),

        async execute(interaction) {
            await interaction.reply(
                "The worst clankers in this server are <@652250448631431170>. \n\n- Fuck you, From Your Enemy, May"
            )

        }
};