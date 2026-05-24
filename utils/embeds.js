const { EmbedBuilder } = require("discord.js");

function successEmbed(title, description) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(0x2ecc71)
        .setTimestamp();
}

function errorEmbed(title, description) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(0xe74c3c)
        .setTimestamp();
}

function logEmbed(title, fields) {
    return new EmbedBuilder()
        .setTitle(title)
        .setColor(0x3498db)
        .addFields(fields)
        .setTimestamp();
}

module.exports = {
    successEmbed,
    errorEmbed,
    logEmbed
};