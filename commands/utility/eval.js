const {
    SlashCommandBuilder
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("eval")
        .setDescription("Evaluate JavaScript code.")
        .addStringOption(option =>
            option
                .setName("code")
                .setDescription("Code to evaluate.")
                .setRequired(true)
        ),

    async execute(interaction) {
        const owners = [
            "1092162323021566103"
        ];

        if (!owners.includes(interaction.user.id)) {
            return interaction.reply({
                content: "No.",
                flags: 64
            });
        }

        const code =
            interaction.options.getString("code");

        try {
            let evaled = eval(code);

            if (typeof evaled !== "string") {
                evaled =
                    require("util").inspect(evaled);
            }

            await interaction.reply({
                content:
                    "```js\n" +
                    evaled.slice(0, 1900) +
                    "\n```"
            });
        } catch (error) {
            await interaction.reply({
                content:
                    "```js\n" +
                    error +
                    "\n```"
            });
        }
    }
};