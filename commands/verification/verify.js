const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const {
    getRobloxUserId,
    getUserRank,
    getDiscordRoleFromRank,
    getRobloxDescription
} = require("../../utils/robloxVerify");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("verify")
        .setDescription("Verify your Roblox group rank.")
        .addStringOption(option =>
            option
                .setName("username")
                .setDescription("Your Roblox username.")
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({
            flags: 64
        });

        const username = interaction.options.getString("username");
        const member = interaction.member;

        let robloxUserId;
        let rank;
        let description;

        try {
            robloxUserId = await getRobloxUserId(username);
            rank = await getUserRank(robloxUserId);
            description = await getRobloxDescription(robloxUserId);
        } catch (error) {
            console.error("Roblox verification lookup failed:", error);

            return interaction.editReply({
                content: "I could not find or check that Roblox account."
            });
        }

        const verificationCode = `EVIL-VERIFY-${interaction.user.id}`;

        if (!description.includes(verificationCode)) {
            return interaction.editReply({
                content:
                    `To prove this is your Roblox account, put this exact code in your Roblox profile/About section:\n\n` +
                    `\`${verificationCode}\`\n\n` +
                    `Then run this command again:\n` +
                    `\`/verify username:${username}\``
            });
        }

        const roleId = getDiscordRoleFromRank(rank);

        if (!roleId) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("open_bug_report")
                    .setLabel("Report Bug")
                    .setStyle(ButtonStyle.Danger)
            );

            await interaction.user.send({
                content:
                    `You proved ownership of **${username}**, but you are not in the Roblox group or do not have a supported rank.\n\n` +
                    `Join here: https://www.roblox.com/groups/${process.env.ROBLOX_GROUP_ID}\n\n` +
                    `If you believe this is a bug, click the button below.`,
                components: [row]
            }).catch(() => {});

            return interaction.editReply({
                content:
                    "You proved ownership, but you are not in the Roblox group or do not have a supported rank. I DMed you instructions."
            });
        }

        await member.roles.add(roleId);

        const currentNickname = member.nickname || interaction.user.username;

        if (!currentNickname.startsWith("Evil")) {
            await member.setNickname(`Evil${currentNickname}`).catch(console.error);
        }

        await interaction.user.send(
            `You have been verified as **${username}** and received your Discord role.`
        ).catch(() => {});

        await interaction.editReply({
            content: `Verified! You received <@&${roleId}>.`
        });
    }
};