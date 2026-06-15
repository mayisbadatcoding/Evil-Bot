const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const {
    saveBotLog,
    getRecentBotLogs
} = require("./storage");

const STARTUP_CHANNEL_ID = "1516185829083447397";

function formatArg(arg) {
    if (arg instanceof Error) return arg.stack || arg.message;

    if (typeof arg === "object") {
        try {
            return JSON.stringify(arg);
        } catch {
            return String(arg);
        }
    }

    return String(arg);
}

async function saveLog(level, args) {
    const message = args.map(formatArg).join(" ");
    await saveBotLog(level, message);
}

function setupLogCapture() {
    const oldLog = console.log;
    const oldError = console.error;
    const oldWarn = console.warn;

    console.log = (...args) => {
        saveLog("LOG", args);
        oldLog(...args);
    };

    console.error = (...args) => {
        saveLog("ERROR", args);
        oldError(...args);
    };

    console.warn = (...args) => {
        saveLog("WARN", args);
        oldWarn(...args);
    };
}

async function getRecentLogsText() {
    const logs = await getRecentBotLogs(5);

    if (!logs.length) return "No logs found from the last 5 minutes.";

    return logs
        .map(log => {
            const time = new Date(log.created_at).toISOString();
            return `[${time}] [${log.level}] ${log.message}`;
        })
        .join("\n")
        .slice(-3500);
}

async function sendStartupMessage(client) {
    const channel = await client.channels.fetch(STARTUP_CHANNEL_ID).catch(() => null);
    if (!channel) return;

    const logs = await getRecentLogsText();

    const embed = new EmbedBuilder()
        .setTitle("Bot Restarted")
        .setColor(0xf1c40f)
        .setDescription("The bot restarted. Was this an error?")
        .addFields({
            name: "Last 5 Minutes of Logs",
            value: `\`\`\`\n${logs.slice(0, 1000)}\n\`\`\``
        })
        .setTimestamp()
        .setFooter({ text: "Evil Bot • Startup Monitor" });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("mark_restart_as_crash")
            .setLabel("Mark as Crash")
            .setStyle(ButtonStyle.Danger)
    );

    await channel.send({
        embeds: [embed],
        components: [row]
    });
}

async function sendCrashMessage(client, error) {
    await saveBotLog("CRASH", error?.stack || error?.message || String(error));

    const channel = await client.channels.fetch(STARTUP_CHANNEL_ID).catch(() => null);
    if (!channel) return;

    const logs = await getRecentLogsText();

    const embed = new EmbedBuilder()
        .setTitle("Bot Crash Detected")
        .setColor(0xe74c3c)
        .setDescription("This was an error. Please figure out the cause of the crash.")
        .addFields(
            {
                name: "Actual Error",
                value: `\`\`\`\n${String(error?.stack || error).slice(0, 1000)}\n\`\`\``
            },
            {
                name: "Last 5 Minutes of Logs",
                value: `\`\`\`\n${logs.slice(0, 1000)}\n\`\`\``
            }
        )
        .setTimestamp()
        .setFooter({ text: "Evil Bot • Crash Monitor" });

    await channel.send({ embeds: [embed] }).catch(() => {});
}

async function getRecentLogs() {
    return await getRecentLogsText();
}

module.exports = {
    setupLogCapture,
    sendStartupMessage,
    sendCrashMessage,
    getRecentLogs
};