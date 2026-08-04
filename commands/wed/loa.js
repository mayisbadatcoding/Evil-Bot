const { SlashCommandBuilder } = require('discord.js');
const { q, audit } = require('../../utils/wedStorage');

function parseTimestamp(value) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(text)) return null;
  const date = new Date(text);
  return Number.isNaN(date.valueOf()) ? null : date;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loa')
    .setDescription('Request and manage your WED leave.')
    .addSubcommand(sub => sub
      .setName('request')
      .setDescription('Submit a leave request to WED leadership.')
      .addStringOption(o => o.setName('start').setDescription('Start time, e.g. 2026-08-10T15:00-04:00').setRequired(true))
      .addStringOption(o => o.setName('return').setDescription('Return time, e.g. 2026-08-17T15:00-04:00').setRequired(true))
      .addStringOption(o => o.setName('timezone').setDescription('Your timezone, e.g. America/New_York').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Why you need leave.').setRequired(true))
      .addStringOption(o => o.setName('notes').setDescription('Optional contact or availability notes.')))
    .addSubcommand(sub => sub.setName('status').setDescription('View your latest leave request.'))
    .addSubcommand(sub => sub.setName('cancel').setDescription('Cancel your latest pending leave request.'))
    .addSubcommand(sub => sub.setName('return').setDescription('Mark your active leave as ended early.')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    await q(`INSERT INTO wed_users(discord_user_id,discord_username,display_name,department_role,access_state,active)
      VALUES($1,$2,$3,'staff','no_access',TRUE)
      ON CONFLICT(discord_user_id) DO UPDATE SET discord_username=$2,display_name=$3,updated_at=NOW()`,
      [userId, interaction.user.username, interaction.member?.displayName || interaction.user.globalName || interaction.user.username]);

    if (sub === 'request') {
      const start = parseTimestamp(interaction.options.getString('start'));
      const end = parseTimestamp(interaction.options.getString('return'));
      const timezone = interaction.options.getString('timezone').trim();
      try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date()); }
      catch { return interaction.reply({ content: 'That timezone is not valid. Use an IANA timezone such as `America/New_York`.', flags: 64 }); }
      if (!start || !end || end <= start) {
        return interaction.reply({ content: 'Use an ISO date and time with a UTC offset, such as `2026-08-10T15:00-04:00`. The return must be after the start.', flags: 64 });
      }
      const days = Math.ceil((end - start) / 86400000);
      const requiresHiatus = days > 183;
      const result = await q(`INSERT INTO wed_leave_requests(
        user_id,leave_type,starts_at,expected_return_at,starts_at_utc,expected_return_at_utc,requester_timezone,
        reason,contact_notes,requires_hiatus,leadership_stepdown_recommended)
        VALUES($1,$2,$3::date,$4::date,$3,$4,$5,$6,$7,$8,FALSE) RETURNING id`,
        [userId, requiresHiatus ? 'hiatus' : 'loa', start.toISOString(), end.toISOString(), timezone,
          interaction.options.getString('reason'), interaction.options.getString('notes') || null, requiresHiatus]);
      await audit(userId, 'submit', 'leave_request', result.rows[0].id, { source: 'discord', timezone, days });
      return interaction.reply({ content: `Your leave request **#${result.rows[0].id}** was submitted.\nStart: <t:${Math.floor(start.getTime()/1000)}:F>\nReturn: <t:${Math.floor(end.getTime()/1000)}:F>`, flags: 64 });
    }

    const latest = (await q(`SELECT * FROM wed_leave_requests WHERE user_id=$1 ORDER BY requested_at DESC LIMIT 1`, [userId])).rows[0];
    if (!latest) return interaction.reply({ content: 'You do not have any leave requests.', flags: 64 });

    if (sub === 'status') {
      const start = Math.floor(new Date(latest.starts_at_utc || latest.starts_at).getTime()/1000);
      const end = Math.floor(new Date(latest.expected_return_at_utc || latest.expected_return_at).getTime()/1000);
      return interaction.reply({ content: `Leave request **#${latest.id}** is **${latest.status}**.\nStart: <t:${start}:F>\nReturn: <t:${end}:F>`, flags: 64 });
    }

    if (sub === 'cancel') {
      if (latest.status !== 'pending') return interaction.reply({ content: 'Only a pending request can be cancelled.', flags: 64 });
      await q(`UPDATE wed_leave_requests SET status='cancelled' WHERE id=$1`, [latest.id]);
      await audit(userId, 'cancel', 'leave_request', latest.id, { source: 'discord' });
      return interaction.reply({ content: `Leave request **#${latest.id}** was cancelled.`, flags: 64 });
    }

    if (!['approved', 'active'].includes(latest.status)) return interaction.reply({ content: 'You do not have an approved or active leave to end.', flags: 64 });
    await q(`UPDATE wed_leave_requests SET status='returned',returned_at=NOW() WHERE id=$1`, [latest.id]);
    await audit(userId, 'return', 'leave_request', latest.id, { source: 'discord' });
    const channel = await interaction.client.channels.fetch('1528916185683591228').catch(() => null);
    if (channel?.isTextBased()) await channel.send(`🎉 Welcome back, <@${userId}>! Your leave has ended early. We are glad to have you back.`);
    return interaction.reply({ content: `Welcome back. Leave request **#${latest.id}** has been closed.`, flags: 64 });
  }
};
