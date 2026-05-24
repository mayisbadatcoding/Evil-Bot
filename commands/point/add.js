const {
    SlashCommandSubcommandBuilder,
    AttachmentBuilder
} = require("discord.js");

const path = require("path");

const { readPoints, savePoints } = require("../../utils/storage");
const { canManagePoints } = require("../../utils/permissions");
const { successEmbed, errorEmbed, logEmbed } = require("../../utils/embeds");

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName("add")
        .setDescription("Add points to a user.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The user to add points to.")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("amount")
                .setDescription("Amount of points to add.")
                .setRequired(true)
                .setMinValue(1)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason for adding points.")
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!canManagePoints(interaction.member)) {
            return interaction.reply({
                embeds: [
                    errorEmbed("Permission Denied", "You cannot use this command.")
                ],
                flags: 64
            });
        }

        const user = interaction.options.getUser("user");
        const amount = interaction.options.getInteger("amount");
        const reason = interaction.options.getString("reason");

        const points = readPoints();

        if (!points[user.id]) {
            points[user.id] = 0;
        }

        points[user.id] += amount;
        savePoints(points);

        const replyEmbed = successEmbed(
            "Points Added",
            `${user} gained **${amount}** point(s).\n\nThey now have **${points[user.id]}** point(s).`
        );

        await interaction.reply({
            embeds: [replyEmbed]
        });

        const attachment = new AttachmentBuilder(
            path.join(__dirname, "../../assets/youdidit.gif")
        );

        const dmEmbed = successEmbed(
            "MWAHAHAHA I GIVETH YOU POINTS!",
            `You stole **${amount}** point(s)!!\n\nReason: **${reason}**\n\nYou now have **${points[user.id]}** point(s)! You stole these points from May.. HOW DARE YOU?!`
        ).setImage("attachment://youdidit.gif");

        await user.send({
            embeds: [dmEmbed],
            files: [attachment]
        }).catch(console.error);

        const logChannel = interaction.client.channels.cache.get(
            process.env.POINT_LOG_CHANNEL
        );

        if (logChannel) {
            const embed = logEmbed("Point Added", [
                {
                    name: "User",
                    value: `${user} (\`${user.id}\`)`
                },
                {
                    name: "Amount",
                    value: `${amount}`,
                    inline: true
                },
                {
                    name: "Total Points",
                    value: `${points[user.id]}`,
                    inline: true
                },
                {
                    name: "Giveth!",
                    value: `${interaction.user}`
                },
                {
                    name: "Reason",
                    value: reason
                }
            ]);

            await logChannel.send({
                embeds: [embed]
            });
        }
    }
};