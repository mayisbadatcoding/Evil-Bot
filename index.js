require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    Collection,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require("discord.js");

const {
    setupLogCapture,
    sendStartupMessage,
    sendCrashMessage,
    getRecentLogs
} = require("./utils/startupMonitor");

setupLogCapture();

const {
    initDatabase,
    isBugReportBanned,
    banBugReporter,
    isPreReleaseEnabled
} = require("./utils/storage");

const {
    canUsePreRelease,
    hasFullCommandAccess
} = require("./utils/permissions");

const addCommand = require("./commands/point/add");
const removeCommand = require("./commands/point/remove");
const checkerCommand = require("./commands/point/checker");

const prereleaseCommand = require("./commands/prerelease/prerelease");
const customRoleCommand = require("./commands/fun/customrole");

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

const playCommand = require("./commands/music/play");
const skipCommand = require("./commands/music/skip");
const stopCommand = require("./commands/music/stop");
const pauseCommand = require("./commands/music/pause");
const resumeCommand = require("./commands/music/resume");
const queueCommand = require("./commands/music/queue");
const nowPlayingCommand = require("./commands/music/nowplaying");
const volumeCommand = require("./commands/music/volume");
const shuffleCommand = require("./commands/music/shuffle");
const loopCommand = require("./commands/music/loop");
const loopQueueCommand = require("./commands/music/loopqueue");
const musicRemoveCommand = require("./commands/music/remove");
const jumpCommand = require("./commands/music/jump");
const autoplayCommand = require("./commands/music/autoplay");
const seekCommand = require("./commands/music/seek");
const twentyFourSevenCommand = require("./commands/music/247");
const bassBoostCommand = require("./commands/music/bassboost");
const nightcoreCommand = require("./commands/music/nightcore");

const verifyCommand = require("./commands/verification/verify");
const verifyAllCommand = require("./commands/verification/verifyall");

const guildMemberAddEvent = require("./events/guildMemberAdd");

const {
    setupMusicPlayer,
    initMusicPlayer
} = require("./utils/musicPlayer");

const { startOAuthServer } = require("./utils/oauthServer");

const PRE_RELEASE_COMMANDS = [
    "customrole",

    "play",
    "skip",
    "stop",
    "pause",
    "resume",
    "queue",
    "nowplaying",
    "volume",
    "shuffle",
    "loop",
    "loopqueue",
    "remove",
    "jump",
    "seek",
    "autoplay",
    "247",
    "bassboost",
    "nightcore"
];

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates
    ]
});

setupMusicPlayer(client);

client.commands = new Collection();

client.commands.set("point add", addCommand);
client.commands.set("point remove", removeCommand);
client.commands.set("point checker", checkerCommand);

client.commands.set("prerelease", prereleaseCommand);
client.commands.set("customrole", customRoleCommand);

client.commands.set("play", playCommand);
client.commands.set("skip", skipCommand);
client.commands.set("stop", stopCommand);
client.commands.set("pause", pauseCommand);
client.commands.set("resume", resumeCommand);
client.commands.set("queue", queueCommand);
client.commands.set("nowplaying", nowPlayingCommand);
client.commands.set("volume", volumeCommand);
client.commands.set("shuffle", shuffleCommand);
client.commands.set("loop", loopCommand);
client.commands.set("loopqueue", loopQueueCommand);
client.commands.set("remove", musicRemoveCommand);
client.commands.set("jump", jumpCommand);
client.commands.set("autoplay", autoplayCommand);
client.commands.set("seek", seekCommand);
client.commands.set("247", twentyFourSevenCommand);
client.commands.set("bassboost", bassBoostCommand);
client.commands.set("nightcore", nightcoreCommand);

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

client.commands.set("verify", verifyCommand);
client.commands.set("verifyall", verifyAllCommand);

client.once("clientReady", async () => {
    try {
        await initDatabase();
        startOAuthServer(client);
        initMusicPlayer(client);
        await sendStartupMessage(client);

        console.log("Database connected and ready.");
        console.log("Roblox connected and ready.");
        console.log(`Logged in as ${client.user.tag}`);
    } catch (error) {
        console.error("Startup failed:", error);
    }
});

client.on("guildMemberAdd", async member => {
    await guildMemberAddEvent.execute(member);
});

client.on("interactionCreate", async interaction => {
    try {
      if (interaction.isButton()) {

    if (interaction.customId === "mark_restart_as_crash") {
        const logs = await getRecentLogs();

        const embed = new EmbedBuilder()
            .setTitle("Restart Marked as Crash")
            .setColor(0xe74c3c)
            .setDescription(
                `${interaction.user} marked this restart as a crash.`
            )
            .addFields({
                name: "Recent Logs",
                value: `\`\`\`\n${logs.slice(0, 1000)}\n\`\`\``
            })
            .setTimestamp();

        await interaction.update({
            embeds: [embed],
            components: []
        });

        return;
    }
}

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

        const preReleaseEnabled = await isPreReleaseEnabled();

        if (
            preReleaseEnabled &&
            PRE_RELEASE_COMMANDS.includes(interaction.commandName) &&
            !canUsePreRelease(interaction.member) &&
            !hasFullCommandAccess(interaction.member)
        ) {
            return interaction.reply({
                content: "This command is currently only available to V1 testers. Contact May to join the team.",
                flags: 64
            });
        }

        await command.execute(interaction);
    } catch (error) {
        console.error("INTERACTION ERROR:", error);

        const errorReply = {
            content: "There was an error while running this interaction.",
            flags: 64
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorReply).catch(console.error);
        } else {
            await interaction.reply(errorReply).catch(console.error);
        }
    }
});

client.on("error", async error => {
    console.error("CLIENT ERROR:", error);
    await sendCrashMessage(client, error);
});

process.on("unhandledRejection", async error => {
    console.error("UNHANDLED PROMISE REJECTION:", error);
    await sendCrashMessage(client, error);
});

process.on("uncaughtException", async error => {
    console.error("UNCAUGHT EXCEPTION:", error);
    await sendCrashMessage(client, error);

    setTimeout(() => {
        process.exit(1);
    }, 1500);
});

client.login(process.env.TOKEN);