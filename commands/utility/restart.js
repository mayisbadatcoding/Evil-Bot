const {
    SlashCommandBuilder
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("restart")
        .setDescription("Restart the bot."),

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
            content: "Restarting..."
        });

        process.exit(0);
    }
};