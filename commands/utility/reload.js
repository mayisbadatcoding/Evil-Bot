const {
    SlashCommandBuilder
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("reload")
        .setDescription("Reload commands."),

    async execute(interaction) {
        const owners = [
            "1092162323021566103"
        ];

        if (!owners.includes(interaction.user.id)) {
            return interaction.reply({
                content: "No.",
                flags: 64
            });
        }

        await interaction.reply({
            content: "Reloading commands requires a restart currently."
        });
    }
};