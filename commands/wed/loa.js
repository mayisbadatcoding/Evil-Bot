const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { q, audit } = require("../../utils/wedStorage");

const LEAVE_CHANNEL_ID = "1528916185683591228";

function isValidTimezone(timezone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function parseLocalDateTime(value, timezone) {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match.map(Number);
  const requestedUtcShape = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let candidate = requestedUtcShape;

  // Resolve the timezone offset without adding another dependency.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(candidate));

    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    const represented = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      0,
      0
    );

    const difference = requestedUtcShape - represented;
    candidate += difference;
    if (difference === 0) break;
  }

  const result = new Date(candidate);
  return Number.isNaN(result.valueOf()) ? null : result;
}

async function sendLeaveMessage(interaction, content) {
  try {
    const channel = await interaction.client.channels.fetch(LEAVE_CHANNEL_ID);
    if (channel?.isTextBased()) await channel.send({ content });
  } catch (error) {
    console.error("Could not send leave-channel message:", error);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("loa")
    .setDescription("Request and manage your WED leave.")
    .addSubcommand(subcommand => subcommand
      .setName("request")
      .setDescription("Submit a leave request to WED Leadership.")
      .addStringOption(option => option
        .setName("start")
        .setDescription("Local start time: YYYY-MM-DD HH:MM")
        .setRequired(true))
      .addStringOption(option => option
        .setName("return")
        .setDescription("Local return time: YYYY-MM-DD HH:MM")
        .setRequired(true))
      .addStringOption(option => option
        .setName("timezone")
        .setDescription("Your timezone, such as America/New_York")
        .setRequired(true))
      .addStringOption(option => option
        .setName("reason")
        .setDescription("Why you need leave")
        .setRequired(true))
      .addStringOption(option => option
        .setName("notes")
        .setDescription("Optional contact or availability notes")))
    .addSubcommand(subcommand => subcommand
      .setName("status")
      .setDescription("View your latest leave request."))
    .addSubcommand(subcommand => subcommand
      .setName("cancel")
      .setDescription("Cancel your latest pending leave request."))
    .addSubcommand(subcommand => subcommand
      .setName("return")
      .setDescription("End your approved or active leave early.")),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const displayName = interaction.member?.displayName || interaction.user.globalName || interaction.user.username;

    await q(`
      INSERT INTO wed_users(discord_user_id,discord_username,display_name,department_role,access_state,active)
      VALUES($1,$2,$3,'staff','no_access',TRUE)
      ON CONFLICT(discord_user_id)
      DO UPDATE SET discord_username=$2,display_name=$3,updated_at=NOW()
    `, [userId, interaction.user.username, displayName]);

    if (subcommand === "request") {
      const timezone = interaction.options.getString("timezone").trim();
      if (!isValidTimezone(timezone)) {
        return interaction.reply({
          content: "That timezone is not valid. Use a timezone such as `America/New_York`, `America/Chicago`, or `Europe/London`.",
          flags: MessageFlags.Ephemeral
        });
      }

      const start = parseLocalDateTime(interaction.options.getString("start"), timezone);
      const end = parseLocalDateTime(interaction.options.getString("return"), timezone);

      if (!start || !end || end <= start) {
        return interaction.reply({
          content: "Use `YYYY-MM-DD HH:MM` for both times, and make sure the return time is after the start time.",
          flags: MessageFlags.Ephemeral
        });
      }

      const days = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
      const requiresHiatus = days > 183;
      const reason = interaction.options.getString("reason");
      const notes = interaction.options.getString("notes") || null;

      const result = await q(`
        INSERT INTO wed_leave_requests(
          user_id,leave_type,starts_at,expected_return_at,
          starts_at_utc,expected_return_at_utc,requester_timezone,
          reason,contact_notes,requires_hiatus,leadership_stepdown_recommended
        )
        VALUES($1,$2,$3::date,$4::date,$3,$4,$5,$6,$7,$8,FALSE)
        RETURNING id
      `, [
        userId,
        requiresHiatus ? "hiatus" : "loa",
        start.toISOString(),
        end.toISOString(),
        timezone,
        reason,
        notes,
        requiresHiatus
      ]);

      const requestId = result.rows[0].id;
      await audit(userId, "submit", "leave_request", requestId, {
        source: "discord",
        timezone,
        days
      });

      return interaction.reply({
        content: `Your leave request **#${requestId}** was sent to WED Leadership.\n**Starts:** <t:${Math.floor(start.getTime() / 1000)}:F>\n**Returns:** <t:${Math.floor(end.getTime() / 1000)}:F>`,
        flags: MessageFlags.Ephemeral
      });
    }

    const latest = (await q(`
      SELECT * FROM wed_leave_requests
      WHERE user_id=$1
      ORDER BY requested_at DESC
      LIMIT 1
    `, [userId])).rows[0];

    if (!latest) {
      return interaction.reply({
        content: "You do not have any leave requests.",
        flags: MessageFlags.Ephemeral
      });
    }

    if (subcommand === "status") {
      const start = Math.floor(new Date(latest.starts_at_utc || latest.starts_at).getTime() / 1000);
      const end = Math.floor(new Date(latest.expected_return_at_utc || latest.expected_return_at).getTime() / 1000);
      return interaction.reply({
        content: `Leave request **#${latest.id}** is **${latest.status}**.\n**Starts:** <t:${start}:F>\n**Returns:** <t:${end}:F>`,
        flags: MessageFlags.Ephemeral
      });
    }

    if (subcommand === "cancel") {
      if (latest.status !== "pending") {
        return interaction.reply({
          content: "Only a pending leave request can be cancelled.",
          flags: MessageFlags.Ephemeral
        });
      }

      await q("UPDATE wed_leave_requests SET status='cancelled' WHERE id=$1", [latest.id]);
      await audit(userId, "cancel", "leave_request", latest.id, { source: "discord" });
      return interaction.reply({
        content: `Leave request **#${latest.id}** was cancelled.`,
        flags: MessageFlags.Ephemeral
      });
    }

    if (!["approved", "active"].includes(latest.status)) {
      return interaction.reply({
        content: "You do not have an approved or active leave to end.",
        flags: MessageFlags.Ephemeral
      });
    }

    await q("UPDATE wed_leave_requests SET status='returned',returned_at=NOW() WHERE id=$1", [latest.id]);
    await audit(userId, "return", "leave_request", latest.id, { source: "discord" });
    await sendLeaveMessage(interaction, `🎉 Welcome back, <@${userId}>! Your leave has ended early. We are glad to have you back.`);

    return interaction.reply({
      content: `Welcome back. Leave request **#${latest.id}** has been closed.`,
      flags: MessageFlags.Ephemeral
    });
  }
};
