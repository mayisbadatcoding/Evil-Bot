const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("maintenance")
        .setDescription("Toggle maintenance mode.")
        .addBooleanOption(option =>
            option
                .setName("enabled")
                .setDescription("Enable or disable maintenance mode.")
                .setRequired(true)
        ),

    async execute(interaction) {
        if (
            !interaction.member.roles.cache.has(
                "1509010872599711764"
            )
        ) {
            return interaction.reply({
                content: "You cannot use this command.",
                flags: 64
            });
        }

        const enabled =
            interaction.options.getBoolean("enabled");

        global.maintenanceMode = enabled;

        await interaction.reply({
            content:
                `Maintenance mode is now ` +
                `${enabled ? "ENABLED" : "DISABLED"}.`
        });
    }
};