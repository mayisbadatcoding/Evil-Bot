const { SlashCommandBuilder } = require("discord.js");

const {
    logFunnyCommand
} = require("../utils/storage");

module.exports = {
    data: new SlashCommandBuilder()
    .setName("fuckyou")
    .setDescription("Try it out and see."),

    async execute(interaction) {
        await interaction.reply(
            `Fuck you, ${interaction.user}.`
        );

        await interaction.user.send(
            "Fuck you."
        ).catch(console.error);

        await logFunnyCommand(
            "fuckyou",
            interaction.user
        );
    }
};