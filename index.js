require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    Collection
} = require("discord.js");

const { initDatabase } = require("./utils/storage");

const addCommand = require("./commands/point/add");
const removeCommand = require("./commands/point/remove");
const checkerCommand = require("./commands/point/checker");

const banCommand = require("./commands/moderation/ban");
const clearWarningsCommand = require("./commands/moderation/clearwarnings");
const muteCommand = require("./commands/moderation/mute");
const unbanCommand = require("./commands/moderation/unban");
const unmuteCommand = require("./commands/moderation/unmute");
const warnCommand = require("./commands/moderation/warn");
const warningsCommand = require("./commands/moderation/warnings");

const clankerCommand = require("./Funny Commands/clanker");
const fuckyouCommand = require("./Funny Commands/fuckyou");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
    ]
});

client.commands = new Collection();

client.commands.set("point add", addCommand);
client.commands.set("point remove", removeCommand);
client.commands.set("point checker", checkerCommand);

client.commands.set("ban", banCommand);
client.commands.set("clearwarnings", clearWarningsCommand);
client.commands.set("mute", muteCommand);
client.commands.set("unban", unbanCommand);
client.commands.set("unmute", unmuteCommand);
client.commands.set("warn", warnCommand);
client.commands.set("warnings", warningsCommand);

client.commands.set("clanker", clankerCommand);
client.commands.set("fuckyou", fuckyouCommand);

client.once("clientReady", async () => {
    try {
        await initDatabase();

        console.log("Database connected and ready.");
        console.log(`Logged in as ${client.user.tag}`);
    } catch (error) {
        console.error("Database failed to initialize:", error);
    }
});

client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    let command;

    if (interaction.commandName === "point") {
        const subcommand = interaction.options.getSubcommand();
        command = client.commands.get(`point ${subcommand}`);
    } else {
        command = client.commands.get(interaction.commandName);
    }

    if (!command) {
        return interaction.reply({
            content: "That command does not exist.",
            flags: 64
        });
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error("COMMAND ERROR:", error);

        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: "There was an error while running this command.",
                    flags: 64
                });
            } else {
                await interaction.reply({
                    content: "There was an error while running this command.",
                    flags: 64
                });
            }
        } catch (replyError) {
            console.error("FAILED TO SEND ERROR RESPONSE:", replyError);
        }
    }
});

client.on("error", error => {
    console.error("CLIENT ERROR:", error);
});

process.on("unhandledRejection", error => {
    console.error("UNHANDLED PROMISE REJECTION:", error);
});

process.on("uncaughtException", error => {
    console.error("UNCAUGHT EXCEPTION:", error);
});

client.login(process.env.TOKEN);