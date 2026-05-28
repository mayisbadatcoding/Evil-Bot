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

const clankerCommand = require("./commands/Funny Commands/clanker");
const fuckyouCommand = require("./commands/Funny Commands/fuckyou");
const silenceCommand = require("./commands/Funny Commands/silence");

const pingCommand = require("./commands/utility/ping");
const eightBallCommand = require("./commands/utility/8ball");
const statusCommand = require("./commands/utility/status");
const maintenanceCommand = require("./commands/utility/maintenance");
const evalCommand = require("./commands/utility/eval");
const reloadCommand = require("./commands/utility/reload");
const restartCommand = require("./commands/utility/restart");

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
client.commands.set("silence", silenceCommand);

client.commands.set("ping", pingCommand);
client.commands.set("8ball", eightBallCommand);
client.commands.set("status", statusCommand);
client.commands.set("maintenance", maintenanceCommand);
client.commands.set("eval", evalCommand);
client.commands.set("reload", reloadCommand);
client.commands.set("restart", restartCommand);

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

    if (
        global.maintenanceMode &&
        !["maintenance", "status", "restart"].includes(interaction.commandName)
    ) {
        return interaction.reply({
            content: "The bot is currently in maintenance mode.",
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