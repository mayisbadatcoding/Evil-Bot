const { SlashCommandBuilder } = require("discord.js");

const {
    setPreReleaseEnabled,
    isPreReleaseEnabled
} = require("../../utils/storage");

const {
    hasFullCommandAccess
} = require("../../utils/permissions");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("prerelease")
        .setDescription("Manage pre-release mode.")
        .addSubcommand(subcommand =>
            subcommand
                .setName("set")
                .setDescription("Enable or disable pre-release restrictions.")
                .addBooleanOption(option =>
                    option
                        .setName("enabled")
                        .setDescription("Enabled means only pre-release testers can use pre-release commands.")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("status")
                .setDescription("Check pre-release mode status.")
        ),

    async execute(interaction) {
        if (!hasFullCommandAccess(interaction.member)) {
            return interaction.reply({
                content: "You cannot use this command.",
                flags: 64
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "set") {
            const enabled = interaction.options.getBoolean("enabled");

            await setPreReleaseEnabled(enabled);

            return interaction.reply({
                content: `Pre-release restrictions are now **${enabled ? "enabled" : "disabled"}**.`
            });
        }

        if (subcommand === "status") {
            const enabled = await isPreReleaseEnabled();

            return interaction.reply({
                content: `Pre-release restrictions are currently **${enabled ? "enabled" : "disabled"}**.`
            });
        }
    }
};