const { EmbedBuilder } = require("discord.js");

const BRAND = {
    name: "Evil Bot",
    footer: "Evil Bot • V1",
    iconURL: null
};

const COLORS = {
    success: 0x2ecc71,
    error: 0xe74c3c,
    warning: 0xf1c40f,
    info: 0x3498db,
    neutral: 0x95a5a6,
    moderation: 0xe67e22,
    points: 0x9b59b6,
    music: 0x1abc9c,
    log: 0x5865f2
};

function clean(value) {
    if (value === null || value === undefined || value === "") {
        return "None provided.";
    }

    return String(value).slice(0, 4096);
}

function fieldSafe(value) {
    if (value === null || value === undefined || value === "") {
        return "None provided.";
    }

    return String(value).slice(0, 1024);
}

function baseEmbed(title, description, color = COLORS.info) {
    const embed = new EmbedBuilder()
        .setTitle(clean(title))
        .setColor(color)
        .setTimestamp()
        .setFooter({ text: BRAND.footer });

    if (description) {
        embed.setDescription(clean(description));
    }

    return embed;
}

function successEmbed(title, description) {
    return baseEmbed(title, description, COLORS.success);
}

function errorEmbed(title, description) {
    return baseEmbed(title, description, COLORS.error);
}

function warningEmbed(title, description) {
    return baseEmbed(title, description, COLORS.warning);
}

function infoEmbed(title, description) {
    return baseEmbed(title, description, COLORS.info);
}

function neutralEmbed(title, description) {
    return baseEmbed(title, description, COLORS.neutral);
}

function musicEmbed(title, description) {
    return baseEmbed(title, description, COLORS.music);
}

function pointsEmbed(title, description) {
    return baseEmbed(title, description, COLORS.points);
}

function moderationEmbed(title, description) {
    return baseEmbed(title, description, COLORS.moderation);
}

function logEmbed(title, fields = []) {
    const safeFields = fields.map(field => ({
        name: fieldSafe(field.name),
        value: fieldSafe(field.value),
        inline: Boolean(field.inline)
    }));

    return baseEmbed(title, null, COLORS.log).addFields(safeFields);
}

function userActionEmbed({
    title,
    action,
    user,
    moderator,
    reason,
    color = COLORS.moderation
}) {
    return baseEmbed(title, null, color).addFields(
        {
            name: "Action",
            value: fieldSafe(action),
            inline: true
        },
        {
            name: "User",
            value: user ? `${user} (\`${user.id}\`)` : "Unknown user.",
            inline: false
        },
        {
            name: "Moderator",
            value: moderator ? `${moderator} (\`${moderator.id}\`)` : "Unknown moderator.",
            inline: false
        },
        {
            name: "Reason",
            value: fieldSafe(reason),
            inline: false
        }
    );
}

module.exports = {
    COLORS,
    fieldSafe,
    baseEmbed,

    successEmbed,
    errorEmbed,
    warningEmbed,
    infoEmbed,
    neutralEmbed,
    musicEmbed,
    pointsEmbed,
    moderationEmbed,
    logEmbed,
    userActionEmbed
};