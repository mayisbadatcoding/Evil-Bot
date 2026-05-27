const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("status")
        .setDescription("Shows bot status."),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle("Bot Status")
            .setColor("Blue")
            .addFields(
                {
                    name: "Status",
                    value: "🟢 Online",
                    inline: true
                },
                {
                    name: "Database",
                    value: "🟢 Connected",
                    inline: true
                },
                {
                    name: "Ping",
                    value: `${Math.round(interaction.client.ws.ping)}ms`,
                    inline: true
                }
            )
            .setTimestamp();

        await interaction.reply({
            embeds: [embed]
        });
    }
};