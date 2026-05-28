const {
    SlashCommandBuilder
} = require("discord.js");

const OWNER_IDS = [
    "1092162323021566103",
    "862405092111548417",
    "129728193182695424",
    "815652645443993650",
    "652250448631431170"
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("silence")
        .setDescription("Silence someone for their actions.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The user to silence.")
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!OWNER_IDS.includes(interaction.user.id)) {
            return interaction.reply({
                content: "You cannot use this command.",
                flags: 64
            });
        }

        const user = interaction.options.getUser("user");
        const member = interaction.options.getMember("user");

        if (!member) {
            return interaction.reply({
                content: "That user is not in this server.",
                flags: 64
            });
        }

        await member.timeout(
            60 * 1000,
            `Silenced by ${interaction.user.tag}`
        );

        await interaction.reply({
            content: `${user} has been silenced. Good job being evil.`
        });

        await interaction.user.send(
            `${interaction.user} silenced ${user}.`
        ).catch(console.error);

        await user.send(
            "You have been silenced for 60 seconds. You do not disrespect great maker of bot May."
        ).catch(console.error);
    }
};