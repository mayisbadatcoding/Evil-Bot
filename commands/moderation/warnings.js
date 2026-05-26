const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { getWarnings } = require("../../utils/storage");
const { successEmbed } = require("../../utils/embeds");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("warnings")
        .setDescription("View a user's warnings.")
        .addUserOption(option =>
            option.setName("user")
                .setDescription("The user to check.")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const user = interaction.options.getUser("user");
        const warnings = await getWarnings(user.id);

        if (warnings.length === 0) {
            return interaction.reply({
                embeds: [successEmbed("Warnings", `${user} has no warnings.`)]
            });
        }

        const warningList = warnings
            .slice(0, 10)
            .map(warn =>
                `**#${warn.id}** — <@${warn.moderator_id}>\n${warn.reason}`
            )
            .join("\n\n");

        await interaction.reply({
            embeds: [successEmbed("Warnings", `${user} has **${warnings.length}** warning(s).\n\n${warningList}`)]
        });
    }
};