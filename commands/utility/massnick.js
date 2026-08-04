const { SlashCommandBuilder } = require("discord.js");

const ALLOWED_USER_IDS = [
    "845446699429658624",
    "1507960920180265114"
];

const ALLOWED_ROLE_IDS = [
    "1515986409196884018"
];

function canUseMassNick(member, userId) {
    return (
        ALLOWED_USER_IDS.includes(userId) ||
        member.roles.cache.some(role => ALLOWED_ROLE_IDS.includes(role.id))
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("massnick")
        .setDescription("Change every member's nickname.")
        .addStringOption(option =>
            option
                .setName("nickname")
                .setDescription("Nickname to apply.")
                .setRequired(true)
                .setMaxLength(32)
        ),

    async execute(interaction) {
        if (!canUseMassNick(interaction.member, interaction.user.id)) {
            return interaction.reply({
                content: "You cannot use this command.",
                flags: 64
            });
        }

        const nickname = interaction.options.getString("nickname");

        await interaction.reply({
            content: `Starting mass nickname update to **${nickname}**...`,
            flags: 64
        });

        let success = 0;
        let failed = 0;

        const members = await interaction.guild.members.fetch();

        for (const [, member] of members) {
            if (
                member.user.bot ||
                member.id === interaction.guild.ownerId ||
                member.roles.highest.position >=
                    interaction.guild.members.me.roles.highest.position
            ) {
                continue;
            }

            try {
                await member.setNickname(
                    nickname,
                    `Mass nickname by ${interaction.user.tag}`
                );

                success++;
            } catch {
                failed++;
            }
        }

        await interaction.followUp({
            content:
                `Mass nickname complete.\n\n` +
                `Successful: **${success}**\n` +
                `Failed: **${failed}**`,
            flags: 64
        });
    }
};