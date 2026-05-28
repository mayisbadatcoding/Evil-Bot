const {
    SlashCommandBuilder
} = require("discord.js");

const OWNER_IDS = [
    "845446699429658624",
    "862405092111548417"
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
        if (interaction.user.id !== OWNER_ID) {
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