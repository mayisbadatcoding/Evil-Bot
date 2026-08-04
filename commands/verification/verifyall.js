const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const {
    getRobloxUserId,
    getUserRank,
    getDiscordRoleFromRank,
} = require("../../utils/robloxVerify");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("verifyall")
        .setDescription("Re-check and role all members who have Evil nicknames.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });

        const members = await interaction.guild.members.fetch();

        let checked = 0;
        let updated = 0;
        let failed = 0;

        for (const member of members.values()) {
            if (member.user.bot) continue;

            const nickname = member.nickname || member.user.username;

            if (!nickname.startsWith("Evil")) continue;

            const robloxUsername = nickname.replace(/^Evil/i, "");

            try {
                const robloxUserId = await getRobloxUserId(robloxUsername);
                const rank = await getUserRank(robloxUserId);
                const roleId = getDiscordRoleFromRank(rank);

                checked++;

                if (!roleId) continue;

                await member.roles.add(roleId);
                updated++;
            } catch {
                failed++;
            }
        }

        await interaction.editReply({
            content: `Verify all complete.\n\nChecked: **${checked}**\nUpdated: **${updated}**\nFailed: **${failed}**`
        });
    }
};