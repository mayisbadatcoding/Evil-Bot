const {
    SlashCommandBuilder,
    PermissionsBitField
} = require("discord.js");

const {
    getPoints,
    getCustomRole,
    saveCustomRole,
    deleteCustomRole,
    isCustomRoleBlacklisted,
    blacklistCustomRoleUser,
    unblacklistCustomRoleUser,
    isPreReleaseEnabled
} = require("../../utils/storage");

const {
    canUsePreRelease,
    hasFullCommandAccess
} = require("../../utils/permissions");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("customrole")
        .setDescription("Create or manage your custom role.")
        .addSubcommand(subcommand =>
            subcommand
                .setName("create")
                .setDescription("Create your own custom role. Requires 20 points.")
                .addStringOption(option =>
                    option
                        .setName("name")
                        .setDescription("The name of your custom role.")
                        .setRequired(true)
                        .setMaxLength(80)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("delete")
                .setDescription("Delete your custom role.")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("blacklist")
                .setDescription("Blacklist someone from custom roles.")
                .addUserOption(option =>
                    option
                        .setName("user")
                        .setDescription("User to blacklist.")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("reason")
                        .setDescription("Reason for blacklist.")
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("unblacklist")
                .setDescription("Unblacklist someone from custom roles.")
                .addUserOption(option =>
                    option
                        .setName("user")
                        .setDescription("User to unblacklist.")
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const preReleaseEnabled = await isPreReleaseEnabled();

        if (preReleaseEnabled && !canUsePreRelease(interaction.member)) {
            return interaction.reply({
                content: "This command is currently in pre-release testing.",
                flags: 64
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "blacklist" || subcommand === "unblacklist") {
            if (!hasFullCommandAccess(interaction.member)) {
                return interaction.reply({
                    content: "You cannot use this subcommand.",
                    flags: 64
                });
            }

            const user = interaction.options.getUser("user");

            if (subcommand === "blacklist") {
                const reason =
                    interaction.options.getString("reason") ||
                    "No reason provided.";

                await blacklistCustomRoleUser(
                    user.id,
                    user.tag,
                    interaction.user.id,
                    interaction.user.tag,
                    reason
                );

                return interaction.reply({
                    content: `${user} has been blacklisted from custom roles.\nReason: **${reason}**`
                });
            }

            if (subcommand === "unblacklist") {
                await unblacklistCustomRoleUser(user.id);

                return interaction.reply({
                    content: `${user} has been unblacklisted from custom roles.`
                });
            }
        }

        const blacklisted = await isCustomRoleBlacklisted(interaction.user.id);

        if (blacklisted) {
            return interaction.reply({
                content: "You are blacklisted from using custom roles.",
                flags: 64
            });
        }

        if (subcommand === "create") {
            const points = await getPoints(interaction.user.id);

            if (points < 20) {
                return interaction.reply({
                    content: `You need at least **20 points** to create a custom role. You currently have **${points}**.`,
                    flags: 64
                });
            }

            const name = interaction.options.getString("name").trim();

            if (
                name.includes("@everyone") ||
                name.includes("@here") ||
                name.length < 2
            ) {
                return interaction.reply({
                    content: "That role name is not allowed.",
                    flags: 64
                });
            }

            if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                return interaction.reply({
                    content: "I need the **Manage Roles** permission to create custom roles.",
                    flags: 64
                });
            }

            const existing = await getCustomRole(interaction.user.id);

            if (existing) {
                const role = interaction.guild.roles.cache.get(existing.role_id);

                if (role) {
                    await role.setName(name);
                    await interaction.member.roles.add(role).catch(() => {});

                    await saveCustomRole(
                        interaction.user.id,
                        interaction.user.tag,
                        role.id,
                        name
                    );

                    return interaction.reply({
                        content: `Your custom role has been renamed to **${name}**.`
                    });
                }
            }

            const role = await interaction.guild.roles.create({
                name,
                mentionable: false,
                hoist: false,
                reason: `Custom role created by ${interaction.user.tag}`
            });

            await interaction.member.roles.add(role);

            await saveCustomRole(
                interaction.user.id,
                interaction.user.tag,
                role.id,
                name
            );

            return interaction.reply({
                content: `Created your custom role: <@&${role.id}>`
            });
        }

        if (subcommand === "delete") {
            const existing = await getCustomRole(interaction.user.id);

            if (!existing) {
                return interaction.reply({
                    content: "You do not have a custom role.",
                    flags: 64
                });
            }

            const role = interaction.guild.roles.cache.get(existing.role_id);

            if (role) {
                await role.delete(
                    `Custom role deleted by ${interaction.user.tag}`
                ).catch(console.error);
            }

            await deleteCustomRole(interaction.user.id);

            return interaction.reply({
                content: "Your custom role has been deleted."
            });
        }
    }
};