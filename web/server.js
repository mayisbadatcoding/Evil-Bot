require("dotenv").config();

const express = require("express");
const path = require("path");
const crypto = require("crypto");

const { q, audit } = require("../utils/wedStorage");
const {
  sessionMiddleware,
  requireLogin,
  requireRole,
  createSession,
  logout
} = require("../utils/wedAuth");
const handbook = require("./handbook");

const DISCORD_API = "https://discord.com/api/v10";
const WED_GUILD_ID = process.env.WED_GUILD_ID;

const ROLE_IDS = {
  botDeveloper: process.env.WED_BOT_DEVELOPER_USER_ID || "1092162323021566103",
  director: process.env.WED_DIRECTOR_ROLE_ID || "1513302783821090827",
  centralLeadership: process.env.WED_CENTRAL_LEADERSHIP_ROLE_ID || "1509588301974077481",
  secretary: process.env.WED_SECRETARY_ROLE_ID || "1516581487351304305",
  conceptLead: process.env.WED_CONCEPT_TEAM_LEAD_ROLE_ID || "1531030166422290462",
  threeDLead: process.env.WED_3D_TEAM_LEAD_ROLE_ID || "1531030185657499749",
  qcLead: process.env.WED_QC_TEAM_LEAD_ROLE_ID || "1531030101653852250",
  scriptingLead: process.env.WED_SCRIPTING_TEAM_LEAD_ROLE_ID || "1531030187083305010",
  suspended: process.env.WED_SUSPENDED_ROLE_ID || "1519387178487120163",
  hiatus: process.env.WED_HIATUS_ROLE_ID || "1525297194335469668",
  scripting: process.env.WED_SCRIPTING_TEAM_ROLE_ID || "1515969259250126898",
  concept: process.env.WED_CONCEPT_TEAM_ROLE_ID || "1531019177735880986",
  threeD: process.env.WED_3D_TEAM_ROLE_ID || "1531018939583172689",
  trialDeveloper: process.env.WED_TRIAL_DEVELOPER_ROLE_ID || "1521657368314642596",
  qc: process.env.WED_QUALITY_CONTROL_ROLE_ID || "1518584191300931705",
  trialQc: process.env.WED_TRIAL_QUALITY_CONTROL_ROLE_ID || "1518583541615558718",
  contractor: process.env.WED_CONTRACTOR_ACCESS_ROLE_ID || "1522809155621097553"
};

const ACCESS_ROLE_IDS = [
  ROLE_IDS.director,
  ROLE_IDS.centralLeadership,
  ROLE_IDS.secretary,
  ROLE_IDS.conceptLead,
  ROLE_IDS.threeDLead,
  ROLE_IDS.qcLead,
  ROLE_IDS.scriptingLead,
  ROLE_IDS.scripting,
  ROLE_IDS.concept,
  ROLE_IDS.threeD,
  ROLE_IDS.trialDeveloper,
  ROLE_IDS.qc,
  ROLE_IDS.trialQc,
  ROLE_IDS.contractor
].filter(Boolean);

const LEADERSHIP_ROLES = new Set([
  "team_lead",
  "secretary",
  "director",
  "executive",
  "bot_developer"
]);

const APPROVER_ROLES = new Set(["secretary", "director", "executive"]);
const IA_ROLES = new Set(["secretary", "director", "executive", "bot_developer"]);

const SECRETARY_PLUS_ROLES = new Set([
  "secretary",
  "director",
  "executive",
  "bot_developer"
]);

function requireTeamLeadPlus(req, res, next) {
  if (!req.user) return res.status(401).send("Login required.");
  if (!LEADERSHIP_ROLES.has(req.user.department_role)) {
    return res.status(403).send("Access denied.");
  }
  next();
}

function requireSecretaryPlus(req, res, next) {
  if (!req.user) return res.status(401).send("Login required.");
  if (!SECRETARY_PLUS_ROLES.has(req.user.department_role)) {
    return res.status(403).send("Access denied.");
  }
  next();
}

function isAdministrator(user) {
  return Boolean(user && ADMIN_USER_IDS.has(String(user.discord_user_id)));
}

function requireAdministrator(req, res, next) {
  if (!req.user) {
    return res.status(401).send("Login required.");
  }

  if (!isAdministrator(req.user)) {
    return res.status(403).send("Access denied.");
  }

  next();
}

function getRequestIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || null;
}

function safeUserAgent(req) {
  return String(req.headers["user-agent"] || "Unknown").slice(0, 1000);
}

let lastGuildSyncAt = 0;
let guildSyncPromise = null;
const GUILD_SYNC_INTERVAL = 10 * 60 * 1000;

const memberAccessRefresh = new Map();
const MEMBER_ACCESS_REFRESH_INTERVAL = 60 * 1000;

function requireApprover(req, res, next) {
  if (!req.user) {
    return res.status(401).send("Login required.");
  }

  if (!APPROVER_ROLES.has(req.user.department_role)) {
    return res.status(403).send("Access denied.");
  }

  next();
}

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function pretty(value = "") {
  return String(value).replaceAll("_", " ").replace(/\b\w/g, char => char.toUpperCase());
}

function date(value) {
  return value ? new Date(value).toLocaleDateString("en-US") : "—";
}

function dateTime(value) {
  return value ? new Date(value).toLocaleString("en-US") : "—";
}

function dateTimeInZone(value, timezone = "UTC") {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "UTC", dateStyle: "medium", timeStyle: "short", timeZoneName: "short"
    }).format(new Date(value));
  } catch { return dateTime(value); }
}

function badge(status) {
  const normalized = String(status || "unknown").toLowerCase();
  return `<span class="badge badge-${esc(normalized)}">${esc(pretty(normalized))}</span>`;
}

const ADMIN_USER_IDS = new Set([
  "1262179224660217948",
  "1092162323021566103",
  "862405092111548417",
  "690720906590552094"
]);

function roleFromMember(member, userId) {
  const ids = new Set(member.roles || []);

  if (ids.has(ROLE_IDS.hiatus)) {
    return { role: "staff", team: null, accessState: "hiatus" };
  }

  let role = "staff";
  let team = null;

  if (ids.has(ROLE_IDS.director) || ids.has(ROLE_IDS.centralLeadership)) role = "director";
  else if (ids.has(ROLE_IDS.secretary)) role = "secretary";
  else if (ids.has(ROLE_IDS.conceptLead)) [role, team] = ["team_lead", "Concept"];
  else if (ids.has(ROLE_IDS.threeDLead)) [role, team] = ["team_lead", "3D"];
  else if (ids.has(ROLE_IDS.qcLead)) [role, team] = ["team_lead", "Quality Control"];
  else if (ids.has(ROLE_IDS.scriptingLead)) [role, team] = ["team_lead", "Scripting"];
  else if (ids.has(ROLE_IDS.qc)) [role, team] = ["qc", "Quality Control"];
  else if (ids.has(ROLE_IDS.trialQc)) [role, team] = ["trial_qc", "Quality Control"];
  else if (ids.has(ROLE_IDS.trialDeveloper)) role = "trial_developer";
  else if (ids.has(ROLE_IDS.scripting)) [role, team] = ["developer", "Scripting"];
  else if (ids.has(ROLE_IDS.concept)) [role, team] = ["developer", "Concept"];
  else if (ids.has(ROLE_IDS.threeD)) [role, team] = ["developer", "3D"];
  else if (ids.has(ROLE_IDS.contractor)) role = "contractor";
  else if (userId === ROLE_IDS.botDeveloper) [role, team] = ["bot_developer", "Bot Development"];

  const leadershipAccess = ["team_lead", "secretary", "director", "executive", "bot_developer"].includes(role)
    || ADMIN_USER_IDS.has(String(userId));
  const accessState = ids.has(ROLE_IDS.suspended)
    ? "suspended"
    : ids.has(ROLE_IDS.hiatus)
      ? "hiatus"
      : leadershipAccess
        ? "active"
        : "no_access";

  return { role, team, accessState };
}

function pageTitle(title, eyebrow, description, action = "") {
  return `
    <section class="pagehead">
      <div>
        <p class="eyebrow">${esc(eyebrow)}</p>
        <h1>${esc(title)}</h1>
        ${description ? `<p>${esc(description)}</p>` : ""}
      </div>
      ${action}
    </section>
  `;
}

function metric(label, value, hint = "") {
  return `
    <article class="metric-card">
      <span>${esc(label)}</span>
      <strong>${esc(value)}</strong>
      ${hint ? `<small>${esc(hint)}</small>` : ""}
    </article>
  `;
}

function emptyState(title, body, action = "") {
  return `
    <section class="empty-state">
      <div class="empty-icon">WED</div>
      <h2>${esc(title)}</h2>
      <p>${esc(body)}</p>
      ${action}
    </section>
  `;
}


function adminDeleteButton(user, type, id, label = "Delete") {
  if (!isAdministrator(user)) return "";

  return `
    <form
      class="admin-delete-form"
      method="post"
      action="/administration/delete/${encodeURIComponent(type)}/${encodeURIComponent(id)}"
      onsubmit="return confirm('Permanently delete this record? This action will be logged.');"
    >
      <button class="danger small" type="submit">${esc(label)}</button>
    </form>
  `;
}

function formField(label, name, value = "", type = "text", required = true, placeholder = "") {
  return `
    <label>
      <span>${esc(label)}</span>
      <input
        name="${esc(name)}"
        type="${esc(type)}"
        value="${esc(value)}"
        ${placeholder ? `placeholder="${esc(placeholder)}"` : ""}
        ${required ? "required" : ""}
      >
    </label>
  `;
}

function textArea(label, name, value = "", required = true, placeholder = "") {
  return `
    <label class="field-span">
      <span>${esc(label)}</span>
      <textarea
        name="${esc(name)}"
        ${placeholder ? `placeholder="${esc(placeholder)}"` : ""}
        ${required ? "required" : ""}
      >${esc(value)}</textarea>
    </label>
  `;
}

function flash(req) {
  return req.query.ok ? `<div class="notice">${esc(req.query.ok)}</div>` : "";
}

function notify(client, title, description) {
  const channelId = process.env.WED_LOG_CHANNEL_ID;
  if (!channelId) return;

  client.channels
    .fetch(channelId)
    .then(channel => channel.send({
      embeds: [{
        title,
        description: String(description).slice(0, 4000),
        color: 0x7c5cff,
        timestamp: new Date().toISOString()
      }]
    }))
    .catch(() => {});
}

function layout(title, body, user = null, active = "") {
  const suspended = user && user.access_state === "suspended";
  const reportOnly = user && user.access_state === "no_access";

  const navItems = user
    ? suspended
      ? [
          ["/suspended", "Suspended", "suspended"],
          ["/my-reports", "My Cases", "reports"],
          ["/privacy", "Privacy Policy", "privacy"]
        ]
      : reportOnly
        ? [
            ["/my-reports", "My IA Reports", "reports"],
            ["/handbook", "Handbook", "handbook"],
            ["/privacy", "Privacy", "privacy"]
          ]
        : [
          ["/dashboard", "Overview", "dashboard"],
          ["/loa", "Leave", "loa"],
          ["/staff-management", "Staff Management", "staff-management"],
          ...(isAdministrator(user) ? [["/administration", "Administration", "administration"]] : [])
        ]
    : [
        ["/", "Home", "home"],
        ["/privacy", "Privacy", "privacy"]
      ];

  const nav = navItems
    .map(([href, label, key]) =>
      `<a class="${active === key ? "active" : ""}" href="${href}">${label}</a>`
    )
    .join("");

  const account = user
    ? `
      <div class="account-menu">
        ${user.avatar_url ? `<img src="${esc(user.avatar_url)}" alt="">` : `<div class="avatar-fallback">${esc((user.display_name || user.discord_username || "W")[0])}</div>`}
        <div class="account-copy">
          <strong>${esc(user.display_name || user.discord_username)}</strong>
          <span>${esc(pretty(user.department_role || "staff"))}</span>
        </div>
        <form method="post" action="/logout">
          <button class="button ghost small">Log out</button>
        </form>
      </div>
    `
    : `<a class="button primary small" href="/login">Staff login</a>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="theme-color" content="#080a10">
    <title>${esc(title)} | WED</title>
    <link rel="stylesheet" href="/assets/style.css">
  </head>
  <body>
    <div class="site-shell">
      <header class="site-header">
        <a class="brand" href="${suspended ? "/suspended" : user ? "/dashboard" : "/"}">
          <span class="brand-mark">WED</span>
          <span class="brand-copy">
            <strong>Wes Evil</strong>
            <small>Development</small>
          </span>
        </a>
        <nav class="main-nav">${nav}</nav>
        ${account}
      </header>
      <main class="page-container">${body}</main>
      <footer class="site-footer">
        <span>Wes Evil Development</span>
        <span>Internal Operations Portal</span>
        <a href="/privacy">Privacy</a>
      </footer>
    </div>
  </body>
</html>`;
}
function accessDeniedPage(user, message = "You do not have permission to access this area.") {
  return layout(
    "Access denied",
    `
      <section class="error-screen">
        <div class="error-code">403</div>

        <div class="error-content">
          <p class="eyebrow">ACCESS RESTRICTED</p>
          <h1>This section is not available to your role.</h1>

          <p>${esc(message)}</p>

          <div class="access-summary">
            <span>Signed in as</span>
            <strong>${esc(user?.display_name || user?.discord_username || "Unknown user")}</strong>
            <small>${esc(pretty(user?.department_role || "staff"))}</small>
          </div>

          <div class="actions">
            <a class="button primary" href="/dashboard">Return to dashboard</a>
            <a class="button ghost" href="javascript:history.back()">Go back</a>
          </div>
        </div>
      </section>
    `,
    user
  );
}

async function ensureIaSchema() {
  await q(`
    CREATE TABLE IF NOT EXISTS wed_ia_case_settings (
      case_id BIGINT PRIMARY KEY REFERENCES wed_background_checks(id) ON DELETE CASCADE,
      subject_discord_id TEXT,
      public_status TEXT NOT NULL DEFAULT 'draft',
      public_summary TEXT,
      public_findings TEXT,
      public_policy_violations TEXT,
      public_outcome TEXT,
      public_appeal_info TEXT,
      allow_appeal BOOLEAN NOT NULL DEFAULT TRUE,
      appeal_deadline TIMESTAMPTZ,
      published_at TIMESTAMPTZ,
      published_by TEXT,
      viewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS wed_ia_notes (
      id BIGSERIAL PRIMARY KEY,
      case_id BIGINT NOT NULL REFERENCES wed_background_checks(id) ON DELETE CASCADE,
      author_id TEXT,
      note_type TEXT NOT NULL DEFAULT 'investigator',
      body TEXT NOT NULL,
      visible_to_subject BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS wed_ia_evidence (
      id BIGSERIAL PRIMARY KEY,
      case_id BIGINT NOT NULL REFERENCES wed_background_checks(id) ON DELETE CASCADE,
      added_by TEXT,
      label TEXT NOT NULL,
      evidence_type TEXT NOT NULL DEFAULT 'url',
      url TEXT,
      description TEXT,
      visible_to_subject BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS wed_ia_timeline (
      id BIGSERIAL PRIMARY KEY,
      case_id BIGINT NOT NULL REFERENCES wed_background_checks(id) ON DELETE CASCADE,
      actor_id TEXT,
      event_type TEXT NOT NULL,
      description TEXT NOT NULL,
      visible_to_subject BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS wed_ia_appeals (
      id BIGSERIAL PRIMARY KEY,
      case_id BIGINT NOT NULL REFERENCES wed_background_checks(id) ON DELETE CASCADE,
      appellant_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      evidence_url TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewer_id TEXT,
      decision_notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ
    )
  `);

  await q(`CREATE INDEX IF NOT EXISTS wed_ia_settings_subject_idx ON wed_ia_case_settings(subject_discord_id)`);
  await q(`CREATE INDEX IF NOT EXISTS wed_ia_notes_case_idx ON wed_ia_notes(case_id)`);
  await q(`CREATE INDEX IF NOT EXISTS wed_ia_evidence_case_idx ON wed_ia_evidence(case_id)`);
  await q(`CREATE INDEX IF NOT EXISTS wed_ia_timeline_case_idx ON wed_ia_timeline(case_id)`);
  await q(`CREATE INDEX IF NOT EXISTS wed_ia_appeals_case_idx ON wed_ia_appeals(case_id)`);

  await q(`
    CREATE TABLE IF NOT EXISTS wed_admin_request_logs (
      id BIGSERIAL PRIMARY KEY,
      discord_user_id TEXT,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      status_code INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      referer TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS wed_admin_login_logs (
      id BIGSERIAL PRIMARY KEY,
      discord_user_id TEXT,
      discord_username TEXT,
      display_name TEXT,
      success BOOLEAN NOT NULL,
      reason TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS wed_admin_actions (
      id BIGSERIAL PRIMARY KEY,
      actor_id TEXT,
      action_type TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      summary TEXT,
      metadata JSONB,
      ip_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await q(`CREATE INDEX IF NOT EXISTS wed_admin_requests_created_idx ON wed_admin_request_logs(created_at DESC)`);
  await q(`CREATE INDEX IF NOT EXISTS wed_admin_logins_created_idx ON wed_admin_login_logs(created_at DESC)`);
  await q(`CREATE INDEX IF NOT EXISTS wed_admin_actions_created_idx ON wed_admin_actions(created_at DESC)`);

  await q(`ALTER TABLE wed_data_requests ADD COLUMN IF NOT EXISTS admin_notes TEXT`);
  await q(`ALTER TABLE wed_data_requests ADD COLUMN IF NOT EXISTS processed_by TEXT`);
  await q(`ALTER TABLE wed_data_requests ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ`);

  await q(`
    CREATE TABLE IF NOT EXISTS wed_pay_profiles (
      discord_user_id TEXT PRIMARY KEY,
      globally_eligible BOOLEAN NOT NULL DEFAULT TRUE,
      globally_disqualified BOOLEAN NOT NULL DEFAULT FALSE,
      disqualification_reason TEXT,
      default_category TEXT,
      default_percentage NUMERIC(8,4),
      default_fixed_pay INTEGER,
      default_bonus_eligible BOOLEAN NOT NULL DEFAULT TRUE,
      notes TEXT,
      updated_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS wed_pay_cycles (
      id BIGSERIAL PRIMARY KEY,
      label TEXT NOT NULL,
      starts_at DATE,
      ends_at DATE,
      total_budget INTEGER,
      developer_pool INTEGER,
      leadership_pool INTEGER,
      bonus_pool INTEGER,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finalized_by TEXT,
      finalized_at TIMESTAMPTZ,
      unlocked_by TEXT,
      unlocked_at TIMESTAMPTZ
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS wed_pay_cycle_members (
      id BIGSERIAL PRIMARY KEY,
      cycle_id BIGINT NOT NULL REFERENCES wed_pay_cycles(id) ON DELETE CASCADE,
      discord_user_id TEXT NOT NULL,
      discord_username TEXT,
      display_name TEXT,
      position TEXT,
      roblox_username TEXT,
      roblox_user_id TEXT,
      category TEXT,
      active_this_cycle BOOLEAN NOT NULL DEFAULT TRUE,
      included BOOLEAN NOT NULL DEFAULT TRUE,
      disqualified BOOLEAN NOT NULL DEFAULT FALSE,
      disqualification_reason TEXT,
      pay_method TEXT NOT NULL DEFAULT 'fixed',
      percentage NUMERIC(8,4),
      regular_pay INTEGER NOT NULL DEFAULT 0,
      bonus INTEGER NOT NULL DEFAULT 0,
      developer_of_month BOOLEAN NOT NULL DEFAULT FALSE,
      notes TEXT,
      dm_status TEXT NOT NULL DEFAULT 'not_sent',
      dm_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(cycle_id,discord_user_id)
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS wed_moderation_records (
      id BIGSERIAL PRIMARY KEY,
      discord_username TEXT,
      discord_user_id TEXT,
      roblox_username TEXT,
      roblox_user_id TEXT,
      position TEXT,
      leadership BOOLEAN NOT NULL DEFAULT FALSE,
      banned BOOLEAN NOT NULL DEFAULT FALSE,
      warnings INTEGER NOT NULL DEFAULT 0,
      strikes INTEGER NOT NULL DEFAULT 0,
      hard_strike BOOLEAN NOT NULL DEFAULT FALSE,
      write_up TEXT,
      rank_locked BOOLEAN NOT NULL DEFAULT FALSE,
      suspended BOOLEAN NOT NULL DEFAULT FALSE,
      status TEXT,
      next_appeal_at DATE,
      moderation_notes TEXT,
      internal_notes TEXT,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS wed_moderation_history (
      id BIGSERIAL PRIMARY KEY,
      record_id BIGINT NOT NULL REFERENCES wed_moderation_records(id) ON DELETE CASCADE,
      changed_by TEXT NOT NULL,
      action TEXT NOT NULL,
      before_data JSONB,
      after_data JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await q(`CREATE INDEX IF NOT EXISTS wed_pay_cycles_status_idx ON wed_pay_cycles(status)`);
  await q(`CREATE INDEX IF NOT EXISTS wed_pay_members_cycle_idx ON wed_pay_cycle_members(cycle_id)`);
  await q(`CREATE INDEX IF NOT EXISTS wed_moderation_lookup_idx ON wed_moderation_records(discord_user_id,roblox_user_id)`);
}

async function addIaTimeline(caseId, actorId, eventType, description, visibleToSubject = false) {
  await q(
    `INSERT INTO wed_ia_timeline(case_id,actor_id,event_type,description,visible_to_subject)
     VALUES($1,$2,$3,$4,$5)`,
    [caseId, actorId || null, eventType, description, visibleToSubject]
  );
}


async function logAdminAction(req, actionType, targetType = null, targetId = null, summary = null, metadata = null) {
  await q(
    `INSERT INTO wed_admin_actions(
      actor_id,action_type,target_type,target_id,summary,metadata,ip_address
    ) VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [
      req.user?.discord_user_id || null,
      actionType,
      targetType,
      targetId == null ? null : String(targetId),
      summary,
      metadata,
      getRequestIp(req)
    ]
  );
}

async function getIaCase(caseId) {
  return (
    await q(
      `
      SELECT
        b.*,
        s.subject_discord_id AS report_subject_id,
        s.public_status,
        s.public_summary,
        s.public_findings,
        s.public_policy_violations,
        s.public_outcome,
        s.public_appeal_info,
        s.allow_appeal,
        s.appeal_deadline,
        s.published_at,
        s.published_by,
        s.viewed_at,
        u.display_name AS investigator_name,
        p.display_name AS publisher_name
      FROM wed_background_checks b
      LEFT JOIN wed_ia_case_settings s ON s.case_id=b.id
      LEFT JOIN wed_users u ON u.discord_user_id=b.investigator_id
      LEFT JOIN wed_users p ON p.discord_user_id=s.published_by
      WHERE b.id=$1
      `,
      [caseId]
    )
  ).rows[0];
}

async function refreshAuthenticatedUserAccess(client, req) {
  if (!req.user?.discord_user_id) return;

  const userId = String(req.user.discord_user_id);
  const lastRefresh = memberAccessRefresh.get(userId) || 0;

  if (Date.now() - lastRefresh < MEMBER_ACCESS_REFRESH_INTERVAL) {
    const stored = (
      await q(
        `SELECT department_role,team,access_state,active,discord_role_ids
         FROM wed_users WHERE discord_user_id=$1`,
        [userId]
      )
    ).rows[0];

    if (stored) Object.assign(req.user, stored);
    return;
  }

  memberAccessRefresh.set(userId, Date.now());

  try {
    const guild = await client.guilds.fetch(WED_GUILD_ID);
    const member = await guild.members.fetch(userId);
    const roleIds = [...member.roles.cache.keys()];
    const access = roleFromMember({ roles: roleIds }, userId);

    await q(
      `UPDATE wed_users
       SET department_role=$1,team=$2,discord_role_ids=$3,
           access_state=$4,active=$5,updated_at=NOW()
       WHERE discord_user_id=$6`,
      [
        access.role,
        access.team,
        JSON.stringify(roleIds),
        access.accessState,
        access.accessState === "active",
        userId
      ]
    );

    Object.assign(req.user, {
      department_role: access.role,
      team: access.team,
      discord_role_ids: roleIds,
      access_state: access.accessState,
      active: access.accessState === "active"
    });
  } catch (error) {
    console.error(`Could not refresh access for ${userId}:`, error);

    const stored = (
      await q(
        `SELECT department_role,team,access_state,active,discord_role_ids
         FROM wed_users WHERE discord_user_id=$1`,
        [userId]
      )
    ).rows[0];

    if (stored) Object.assign(req.user, stored);
  }
}

async function syncGuildMembers(client, force = false) {
  const now = Date.now();

  if (!force && now - lastGuildSyncAt < GUILD_SYNC_INTERVAL) {
    return;
  }

  if (guildSyncPromise) {
    return guildSyncPromise;
  }

  guildSyncPromise = (async () => {
    const guild = await client.guilds.fetch(WED_GUILD_ID);
    let members = guild.members.cache;

    if (!members.size || force) {
      try {
        members = await guild.members.fetch();
      } catch (error) {
        console.error("Guild member sync failed:", error);

        if (!guild.members.cache.size) {
          throw error;
        }

        members = guild.members.cache;
      }
    }

    for (const member of members.values()) {
      if (member.user.bot) continue;

      const roleIds = [...member.roles.cache.keys()];
      const access = roleFromMember({ roles: roleIds }, member.id);
      const avatar = member.user.displayAvatarURL({
        extension: "png",
        size: 256
      });

      await q(
        `
        INSERT INTO wed_users (
          discord_user_id,
          discord_username,
          display_name,
          avatar_url,
          department_role,
          team,
          discord_role_ids,
          access_state,
          active,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,NOW())
        ON CONFLICT (discord_user_id)
        DO UPDATE SET
          discord_username = EXCLUDED.discord_username,
          display_name = EXCLUDED.display_name,
          avatar_url = EXCLUDED.avatar_url,
          department_role = EXCLUDED.department_role,
          team = EXCLUDED.team,
          discord_role_ids = EXCLUDED.discord_role_ids,
          access_state = EXCLUDED.access_state,
          active = TRUE,
          updated_at = NOW()
        `,
        [
          member.id,
          member.user.username,
          member.displayName,
          avatar,
          access.role,
          access.team,
          JSON.stringify(roleIds),
          access.accessState
        ]
      );
    }

    lastGuildSyncAt = Date.now();
  })();

  try {
    await guildSyncPromise;
  } finally {
    guildSyncPromise = null;
  }
}

function startWedServer(client) {
  const app = express();

  app.set("trust proxy", 1);
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));
  app.use(express.json({ limit: "2mb" }));
  app.use("/assets", express.static(path.join(__dirname, "public")));
  app.use(sessionMiddleware);

  app.use((req, res, next) => {
    if (req.path.startsWith("/assets/") || req.path === "/api/health") {
      return next();
    }

    const startedAt = Date.now();

    res.on("finish", () => {
      q(
        `INSERT INTO wed_admin_request_logs(
          discord_user_id,method,path,status_code,ip_address,user_agent,referer
        ) VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [
          req.user?.discord_user_id || null,
          req.method,
          req.originalUrl.slice(0, 2000),
          res.statusCode,
          getRequestIp(req),
          safeUserAgent(req),
          String(req.headers.referer || "").slice(0, 2000) || null
        ]
      ).catch(error => console.error("Request log failed:", error));
    });

    next();
  });

  app.use(async (req, res, next) => {
    if (!req.user) return next();

    await refreshAuthenticatedUserAccess(client, req);

    if (req.user.access_state !== "suspended") {
      return next();
    }

    const allowedExactPaths = new Set([
      "/suspended",
      "/privacy",
      "/privacy/request",
      "/my-reports",
      "/logout",
      "/api/health"
    ]);

    const allowed =
      allowedExactPaths.has(req.path) ||
      req.path.startsWith("/assets/") ||
      /^\/my-reports\/\d+$/.test(req.path) ||
      /^\/my-reports\/\d+\/appeal$/.test(req.path);

    if (allowed) return next();

    return res.redirect("/suspended");
  });

  app.get("/access-removed", requireLogin, (req, res) => {
    const body = `
      ${pageTitle("The portal has changed", "WED STAFF NOTICE", "General staff access to the WED Portal has been retired.")}
      <section class="panel prose">
        <h2>Thank you for everything you contribute to WED.</h2>
        <p>We have changed the WED Portal into a dedicated leadership and administrative workspace. As part of that change, general staff access has been removed.</p>
        <p>This does not affect your position, standing, or value to the department. Staff services, including leave requests, are now available through Discord commands.</p>
        <p>We appreciate the work you do and understand that a change like this may feel abrupt. It is an operational change only. Leadership is available if you believe you should have access or need assistance.</p>
        <div class="actions"><a class="button primary" href="https://discord.com/channels/${WED_GUILD_ID}">Return to Discord</a></div>
      </section>`;
    res.send(layout("Portal access changed", body, req.user));
  });

  app.use((req, res, next) => {
    if (!req.user) return next();
    const leadership = LEADERSHIP_ROLES.has(req.user.department_role) || isAdministrator(req.user);
    const allowed = new Set(["/access-removed", "/logout", "/privacy", "/privacy/request", "/api/health"]);
    if (!leadership && !allowed.has(req.path) && !req.path.startsWith("/assets/")) return res.redirect("/access-removed");
    next();
  });

  const retiredPrefixes = ["/development", "/qc", "/quotas", "/hiring", "/background-checks", "/my-reports", "/handbook", "/apply"];
  app.use((req, res, next) => {
    if (retiredPrefixes.some(prefix => req.path === prefix || req.path.startsWith(prefix + "/"))) return res.redirect(req.user ? "/dashboard" : "/");
    next();
  });

  app.use((req, res, next) => {
  const originalSend = res.send.bind(res);

  res.send = body => {
    const deniedMessages = [
      "Access denied.",
      "Access denied",
      "Insufficient permissions.",
      "You do not have permission to access this resource."
    ];

    if (
      res.statusCode === 403 &&
      typeof body === "string" &&
      deniedMessages.includes(body.trim())
    ) {
      return originalSend(
        accessDeniedPage(
          req.user,
          "Your current department role does not include access to this section."
        )
      );
    }

    return originalSend(body);
  };

  next();
});

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; style-src 'self'; img-src 'self' https://cdn.discordapp.com data:; form-action 'self'; frame-ancestors 'none'; base-uri 'self'"
    );
    next();
  });

  app.get("/", (req, res) => {
    const body = `
      <section class="hero leadership-hero">
        <div class="hero-copy">
          <p class="eyebrow">WED LEADERSHIP OPERATIONS</p>
          <h1>The administrative center for WED leadership.</h1>
          <p>Review staff records, leave requests, discipline, payroll, and the operational decisions that keep the department functioning.</p>
          <div class="actions">
            <a class="button primary" href="${req.user ? "/dashboard" : "/login"}">${req.user ? "Open leadership portal" : "Leadership login"}</a>
          </div>
        </div>
        <div class="hero-panel">
          <span>Portal access</span>
          <strong>Leadership only</strong>
          <ul>
            <li>Administration</li>
            <li>Directors and Central Leadership</li>
            <li>Secretaries and Team Leads</li>
          </ul>
        </div>
      </section>
      <section class="feature-grid">
        <article><span>01</span><h2>Oversee</h2><p>Keep staff records, roles, and department status organized.</p></article>
        <article><span>02</span><h2>Decide</h2><p>Review leave, disciplinary matters, and pending leadership actions.</p></article>
        <article><span>03</span><h2>Operate</h2><p>Manage payroll, audit history, and administrative controls.</p></article>
      </section>
    `;
    res.send(layout("Leadership Operations Portal", body, req.user, "home"));
  });

  app.get("/login", async (req, res) => {
    const state = crypto.randomBytes(24).toString("hex");
    await q("INSERT INTO wed_oauth_states(state,return_to) VALUES($1,$2)", [state, "/dashboard"]);

    const redirect =
      process.env.WED_DISCORD_REDIRECT_URI ||
      `${process.env.BASE_URL}/auth/discord/callback`;

    const params = new URLSearchParams({
      client_id: process.env.CLIENT_ID,
      response_type: "code",
      redirect_uri: redirect,
      scope: "identify guilds.members.read",
      state
    });

    res.redirect(`https://discord.com/oauth2/authorize?${params}`);
  });

  app.get("/auth/discord/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      const stateResult = await q(
        "DELETE FROM wed_oauth_states WHERE state=$1 AND created_at>NOW()-INTERVAL '10 minutes' RETURNING *",
        [state]
      );

      if (!code || !stateResult.rows[0]) {
        return res.status(400).send("Invalid or expired login.");
      }

      const redirect =
        process.env.WED_DISCORD_REDIRECT_URI ||
        `${process.env.BASE_URL}/auth/discord/callback`;

      const tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.CLIENT_ID,
          client_secret: process.env.DISCORD_CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirect
        })
      });

      if (!tokenResponse.ok) throw new Error(await tokenResponse.text());

      const tokenData = await tokenResponse.json();
      const headers = { Authorization: `Bearer ${tokenData.access_token}` };

      const [userResponse, memberResponse] = await Promise.all([
        fetch(`${DISCORD_API}/users/@me`, { headers }),
        fetch(`${DISCORD_API}/users/@me/guilds/${WED_GUILD_ID}/member`, { headers })
      ]);

      if (!userResponse.ok || !memberResponse.ok) {
        return res.status(403).send("You must be a member of the WED Discord server.");
      }

      const discordUser = await userResponse.json();
      const discordMember = await memberResponse.json();
      const access = roleFromMember(discordMember, discordUser.id);
      const avatar = discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : null;

      await q(
        `
        INSERT INTO wed_users (
          discord_user_id,
          discord_username,
          display_name,
          avatar_url,
          department_role,
          team,
          discord_role_ids,
          access_state,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
        ON CONFLICT(discord_user_id)
        DO UPDATE SET
          discord_username=$2,
          display_name=$3,
          avatar_url=$4,
          department_role=$5,
          team=$6,
          discord_role_ids=$7,
          access_state=$8,
          updated_at=NOW()
        `,
        [
          discordUser.id,
          discordUser.username,
          discordMember.nick || discordUser.global_name || discordUser.username,
          avatar,
          access.role,
          access.team,
          JSON.stringify(discordMember.roles || []),
          access.accessState
        ]
      );

      const user = (
        await q("SELECT * FROM wed_users WHERE discord_user_id=$1", [discordUser.id])
      ).rows[0];

      await q(
        `INSERT INTO wed_admin_login_logs(
          discord_user_id,discord_username,display_name,success,reason,ip_address,user_agent
        ) VALUES($1,$2,$3,TRUE,$4,$5,$6)`,
        [
          discordUser.id,
          discordUser.username,
          user.display_name || discordUser.username,
          access.accessState,
          getRequestIp(req),
          safeUserAgent(req)
        ]
      );

      await createSession(res, user, req);
      await audit(discordUser.id, "login", "session", null, {
        role: access.role,
        team: access.team,
        access_state: access.accessState
      });

      if (access.accessState === "suspended") {
        return res.redirect("/suspended");
      }

      if (access.accessState === "hiatus") {
        return res.status(403).send("Your WED portal access is disabled while your hiatus role is active.");
      }

      if (access.accessState === "no_access") {
        return res.redirect("/access-removed");
      }

      res.redirect("/dashboard");
    } catch (error) {
      console.error("Discord OAuth failed:", error);

      q(
        `INSERT INTO wed_admin_login_logs(
          success,reason,ip_address,user_agent
        ) VALUES(FALSE,$1,$2,$3)`,
        [
          String(error?.message || error).slice(0, 1500),
          getRequestIp(req),
          safeUserAgent(req)
        ]
      ).catch(logError => console.error("Failed login log failed:", logError));

      res.status(500).send("Discord login failed.");
    }
  });

  app.post("/logout", async (req, res) => {
    await logout(req, res);
    res.redirect("/");
  });

  app.get("/suspended", requireLogin, async (req, res) => {
    if (req.user.access_state !== "suspended") {
      return res.redirect("/dashboard");
    }

    const caseCount = await q(
      `SELECT COUNT(*)
       FROM wed_ia_case_settings
       WHERE subject_discord_id=$1
         AND public_status='published'`,
      [req.user.discord_user_id]
    );

    const body = `
      <section class="suspended-screen">
        <div class="suspended-lock">S</div>
        <div class="suspended-content">
          <p class="eyebrow">ACCESS REVOKED</p>
          <h1>Your WED access is suspended.</h1>
          <p>
            Your department and public-facing portal access has been revoked
            while the suspended role remains assigned to your Discord account.
          </p>

          <div class="suspension-summary">
            <div>
              <span>Account</span>
              <strong>${esc(req.user.display_name || req.user.discord_username)}</strong>
            </div>
            <div>
              <span>Access state</span>
              <strong>Suspended</strong>
            </div>
            <div>
              <span>Available cases</span>
              <strong>${esc(caseCount.rows[0].count)}</strong>
            </div>
          </div>

          <div class="suspended-notice">
            <strong>You may access only three areas:</strong>
            <p>this suspension page, the Privacy Policy, and Internal Affairs cases published specifically to your Discord account.</p>
          </div>

          <div class="actions">
            <a class="button primary" href="/my-reports">View my cases</a>
            <a class="button ghost" href="/privacy">Privacy policy</a>
          </div>
        </div>
      </section>
    `;

    res.send(layout("Access Suspended", body, req.user, "suspended"));
  });

  app.get("/dashboard", requireLogin, requireTeamLeadPlus, async (req, res) => {
    const [staff, pendingLeave, activeLeave, pendingDiscipline, openPayCycles, recentAudit] = await Promise.all([
      q("SELECT COUNT(*) FROM wed_users WHERE active=TRUE"),
      q("SELECT COUNT(*) FROM wed_leave_requests WHERE status='pending'"),
      q("SELECT COUNT(*) FROM wed_leave_requests WHERE status IN ('approved','active')"),
      q("SELECT COUNT(*) FROM wed_punishments WHERE status='pending'"),
      q("SELECT COUNT(*) FROM wed_pay_cycles WHERE status <> 'finalized'"),
      q(`
        SELECT action,entity_type,entity_id,created_at
        FROM wed_audit_log
        ORDER BY created_at DESC
        LIMIT 8
      `)
    ]);

    const activity = recentAudit.rows.map(item => `
      <article class="activity-item">
        <div>
          <span>${esc(pretty(item.entity_type))}</span>
          <strong>${esc(pretty(item.action))}${item.entity_id ? ` · #${esc(item.entity_id)}` : ""}</strong>
        </div>
        <time>${esc(dateTimeInZone(item.created_at, req.user.timezone || "UTC"))}</time>
      </article>
    `).join("");

    const body = `
      ${flash(req)}
      ${pageTitle(
        `Welcome back, ${req.user.display_name || req.user.discord_username}`,
        "LEADERSHIP COMMAND CENTER",
        `${pretty(req.user.department_role)}${req.user.team ? ` · ${req.user.team}` : ""}`
      )}
      <section class="metrics-grid leadership-metrics">
        ${metric("Active staff records", staff.rows[0].count, "Department-wide")}
        ${metric("Leave awaiting review", pendingLeave.rows[0].count, "Needs a decision")}
        ${metric("Approved or active leave", activeLeave.rows[0].count, "Current availability")}
        ${metric("Pending discipline", pendingDiscipline.rows[0].count, "Awaiting leadership")}
        ${metric("Open pay cycles", openPayCycles.rows[0].count, "Draft or active")}
      </section>
      <section class="dashboard-grid">
        <div class="panel">
          <div class="section-heading">
            <div><p class="eyebrow">LEADERSHIP WORKSPACE</p><h2>Priority areas</h2></div>
          </div>
          <div class="quick-grid">
            <a href="/loa"><strong>Leave management</strong><span>Approve, deny, and manage staff returns.</span></a>
            <a href="/staff-management"><strong>Staff management</strong><span>Review staff status, roles, and records.</span></a>
            <a href="/punishments"><strong>Discipline</strong><span>Review and manage disciplinary actions.</span></a>
            <a href="/pay"><strong>Payroll</strong><span>Manage pay cycles, eligibility, and payouts.</span></a>
            ${isAdministrator(req.user) ? `<a href="/administration"><strong>Administration</strong><span>System controls, privacy requests, and audit tools.</span></a>` : ""}
          </div>
        </div>
        <div class="panel">
          <div class="section-heading">
            <div><p class="eyebrow">RECENT ACTIVITY</p><h2>Leadership record</h2></div>
          </div>
          <div class="activity-feed">
            ${activity || `<p class="muted">No recent leadership activity.</p>`}
          </div>
        </div>
      </section>
    `;

    res.send(layout("Leadership Dashboard", body, req.user, "dashboard"));
  });

  app.get("/development", requireLogin, async (req, res) => {
    const result = await q(`
      SELECT d.*, u.display_name
      FROM wed_development_logs d
      JOIN wed_users u ON u.discord_user_id=d.author_id
      ORDER BY d.created_at DESC
      LIMIT 100
    `);

    const cards = result.rows.map(item => `
      <article class="record-card">
        <div class="record-topline">
          <div>
            <span class="record-kicker">${esc(item.project)}</span>
            <h2>${esc(item.summary)}</h2>
          </div>
          ${badge(item.qc_status)}
        </div>
        <p>${esc(item.details || "No additional details were provided.")}</p>
        <div class="record-meta">
          <span>${esc(item.display_name)}</span>
          <span>${esc(pretty(item.work_type))}</span>
          <span>${esc(date(item.created_at))}</span>
          ${item.hours ? `<span>${esc(item.hours)} hours</span>` : ""}
        </div>
        <div class="record-actions">
          ${item.evidence_url ? `<a class="button ghost small" href="${esc(item.evidence_url)}">Open evidence</a>` : ""}
          ${item.qc_status === "not_submitted" || item.qc_status === "draft"
            ? `<form method="post" action="/development/${item.id}/qc"><button class="primary small">Send to QC</button></form>`
            : ""}
          ${adminDeleteButton(req.user, "development_log", item.id)}
        </div>
      </article>
    `).join("");

    const body = `
      ${flash(req)}
      ${pageTitle(
        "Development records",
        "DEVELOPMENT",
        "Completed work, evidence, hours, and quality-control status.",
        `<a class="button primary" href="/development/new">New log</a>`
      )}
      <section class="record-grid">
        ${cards || emptyState("No development logs", "Completed work will appear here.", `<a class="button primary" href="/development/new">Create the first log</a>`)}
      </section>
    `;

    res.send(layout("Development", body, req.user, "development"));
  });

  app.get("/development/new", requireLogin, (req, res) => {
    const body = `
      ${pageTitle(
        "Log completed work",
        "DEVELOPMENT",
        "Create a clear record of what changed and where it can be reviewed."
      )}
      <form class="panel form-grid" method="post" action="/development">
        ${formField("Project", "project", "", "text", true, "Portal, game system, bot feature...")}
        ${formField("Short summary", "summary", "", "text", true, "What was completed?")}
        ${formField("Work type", "work_type", "development")}
        ${formField("Hours", "hours", "", "number", false)}
        ${formField("Evidence URL", "evidence_url", "", "url", false, "https://")}
        ${textArea("Details", "details", "", false, "Explain the work, decisions, and anything QC should know.")}
        <div class="form-actions">
          <button class="primary">Save development log</button>
          <a class="button ghost" href="/development">Cancel</a>
        </div>
      </form>
    `;
    res.send(layout("New Development Log", body, req.user, "development"));
  });

  app.post("/development", requireLogin, async (req, res) => {
    const result = await q(
      `
      INSERT INTO wed_development_logs (
        author_id, project, summary, details, work_type, hours, evidence_url
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id
      `,
      [
        req.user.discord_user_id,
        req.body.project,
        req.body.summary,
        req.body.details || null,
        req.body.work_type || "development",
        req.body.hours || null,
        req.body.evidence_url || null
      ]
    );

    await q(
      `
      INSERT INTO wed_change_logs(author_id,area,change_summary,reference_url)
      VALUES($1,$2,$3,$4)
      `,
      [
        req.user.discord_user_id,
        req.body.project,
        req.body.summary,
        req.body.evidence_url || null
      ]
    );

    await audit(req.user.discord_user_id, "create", "development_log", result.rows[0].id);
    notify(client, "Development log created", `${req.user.display_name}: ${req.body.project} — ${req.body.summary}`);
    res.redirect("/development?ok=Development%20log%20saved");
  });

  app.post("/development/:id/qc", requireLogin, async (req, res) => {
    const result = await q(
      `
      UPDATE wed_development_logs
      SET qc_status='submitted', updated_at=NOW()
      WHERE id=$1
      RETURNING *
      `,
      [req.params.id]
    );

    if (result.rows[0]) {
      await q(
        "INSERT INTO wed_qc_handoffs(development_log_id,submitted_by) VALUES($1,$2)",
        [req.params.id, req.user.discord_user_id]
      );
      await audit(req.user.discord_user_id, "submit_to_qc", "development_log", req.params.id);
      notify(client, "Work submitted to QC", `${result.rows[0].project}: ${result.rows[0].summary}`);
    }

    res.redirect("/development?ok=Submitted%20to%20QC");
  });

  app.get("/qc", requireLogin, async (req, res) => {
    const result = await q(`
      SELECT h.*, d.project, d.summary, d.details, d.evidence_url, u.display_name
      FROM wed_qc_handoffs h
      JOIN wed_development_logs d ON d.id=h.development_log_id
      JOIN wed_users u ON u.discord_user_id=h.submitted_by
      ORDER BY
        CASE WHEN h.result='pending' THEN 0 ELSE 1 END,
        h.submitted_at DESC
    `);

    const cards = result.rows.map(item => `
      <article class="review-card">
        <div class="record-topline">
          <div>
            <span class="record-kicker">${esc(item.project)}</span>
            <h2>${esc(item.summary)}</h2>
          </div>
          ${badge(item.result)}
        </div>
        <p>${esc(item.details || "No testing notes supplied by the developer.")}</p>
        <div class="record-meta">
          <span>Submitted by ${esc(item.display_name)}</span>
          <span>${esc(dateTime(item.submitted_at))}</span>
        </div>
        ${item.result === "pending" ? `
          <form class="review-form" method="post" action="/qc/${item.id}">
            <label>
              <span>Decision</span>
              <select name="result">
                <option value="approved">Approve</option>
                <option value="changes_requested">Request changes</option>
                <option value="rejected">Reject</option>
              </select>
            </label>
            <label class="field-span">
              <span>Testing notes</span>
              <textarea name="testing_notes" placeholder="What was tested? What passed or failed?"></textarea>
            </label>
            <div class="form-actions">
              ${item.evidence_url ? `<a class="button ghost" href="${esc(item.evidence_url)}">Open evidence</a>` : ""}
              <button class="primary">Complete review</button>
              ${adminDeleteButton(req.user, "qc_handoff", item.id)}
            </div>
          </form>
        ` : `
          <div class="review-summary">
            <strong>Testing notes</strong>
            <p>${esc(item.testing_notes || "No notes recorded.")}</p>
          </div>
          <div class="record-actions">${adminDeleteButton(req.user, "qc_handoff", item.id)}</div>
        `}
      </article>
    `).join("");

    const body = `
      ${pageTitle("Quality Control", "QUALITY CONTROL", "Review submitted work and record a defensible result.")}
      <section class="record-grid">
        ${cards || emptyState("Nothing awaiting QC", "Submitted work will appear here for review.")}
      </section>
    `;

    res.send(layout("Quality Control", body, req.user, "qc"));
  });

  app.post("/qc/:id", requireLogin, async (req, res) => {
    const handoff = (
      await q(
        `
        UPDATE wed_qc_handoffs
        SET assigned_to=$1, testing_notes=$2, result=$3, reviewed_at=NOW()
        WHERE id=$4
        RETURNING *
        `,
        [
          req.user.discord_user_id,
          req.body.testing_notes || null,
          req.body.result,
          req.params.id
        ]
      )
    ).rows[0];

    if (handoff) {
      await q(
        "UPDATE wed_development_logs SET qc_status=$1,updated_at=NOW() WHERE id=$2",
        [req.body.result, handoff.development_log_id]
      );
      await audit(req.user.discord_user_id, "qc_review", "qc_handoff", req.params.id, {
        result: req.body.result
      });
      notify(client, "QC review completed", `Handoff #${req.params.id}: ${req.body.result}`);
    }

    res.redirect("/qc");
  });

  app.get("/quotas", requireLogin, async (req, res) => {
    const periods = await q(`
      SELECT p.*, COUNT(e.id) entries,
      COUNT(*) FILTER(WHERE e.status='met') met
      FROM wed_quota_periods p
      LEFT JOIN wed_quota_entries e ON e.period_id=p.id
      GROUP BY p.id
      ORDER BY p.starts_at DESC
    `);

    const cards = periods.rows.map(period => {
      const total = Number(period.entries || 0);
      const met = Number(period.met || 0);
      const percentage = total ? Math.round((met / total) * 100) : 0;

      return `
        <article class="quota-card">
          <div class="record-topline">
            <div>
              <span class="record-kicker">${esc(date(period.starts_at))} – ${esc(date(period.ends_at))}</span>
              <h2>${esc(period.label)}</h2>
            </div>
            ${badge(period.status)}
          </div>
          <div class="progress"><span style="width:${percentage}%"></span></div>
          <div class="quota-stats">
            <span><strong>${met}</strong> met</span>
            <span><strong>${total}</strong> assigned</span>
            <span><strong>${esc(period.target_points)}</strong> target</span>
          </div>
          <div class="record-actions">${adminDeleteButton(req.user, "quota_period", period.id)}</div>
        </article>
      `;
    }).join("");

    const canManage = LEADERSHIP_ROLES.has(req.user.department_role);
    const managerForm = canManage ? `
      <details class="panel collapsible">
        <summary>Create quota period</summary>
        <form class="form-grid" method="post" action="/quotas">
          ${formField("Label", "label")}
          ${formField("Starts", "starts_at", "", "datetime-local")}
          ${formField("Ends", "ends_at", "", "datetime-local")}
          ${formField("Target points", "target_points", "1", "number")}
          <div class="form-actions"><button class="primary">Create and assign</button></div>
        </form>
      </details>
    ` : "";

    const body = `
      ${flash(req)}
      ${pageTitle("Quota periods", "QUOTAS", "Track expectations, completion, and active reporting periods.")}
      ${managerForm}
      <section class="record-grid">
        ${cards || emptyState("No quota periods", "Leadership-created quota periods will appear here.")}
      </section>
    `;

    res.send(layout("Quotas", body, req.user, "quotas"));
  });

  app.post("/quotas", requireRole("team_lead"), async (req, res) => {
    const period = (
      await q(
        `
        INSERT INTO wed_quota_periods(
          label, starts_at, ends_at, target_points, status, created_by
        )
        VALUES($1,$2,$3,$4,'open',$5)
        RETURNING id
        `,
        [
          req.body.label,
          req.body.starts_at,
          req.body.ends_at,
          req.body.target_points,
          req.user.discord_user_id
        ]
      )
    ).rows[0];

    await q(
      `
      INSERT INTO wed_quota_entries(period_id,user_id)
      SELECT $1,discord_user_id
      FROM wed_users
      WHERE active=TRUE
        AND department_role IN ('developer','staff','team_lead','trial_developer')
      ON CONFLICT DO NOTHING
      `,
      [period.id]
    );

    await audit(req.user.discord_user_id, "create", "quota_period", period.id);
    notify(client, "Quota period created", req.body.label);
    res.redirect("/quotas?ok=Quota%20period%20created");
  });

  async function sendLeaveChannelMessage(content) {
    try {
      const channel = await client.channels.fetch("1528916185683591228");
      if (channel && channel.isTextBased()) await channel.send({ content });
    } catch (error) { console.error("Leave notification failed:", error); }
  }

  async function changeMemberRoles(userId, { add = [], remove = [] }) {
    const guild = await client.guilds.fetch(WED_GUILD_ID);
    const member = await guild.members.fetch(userId);

    if (remove.length) {
      await member.roles.remove(remove.filter(Boolean), "WED portal LOA/hiatus update");
    }

    if (add.length) {
      await member.roles.add(add.filter(Boolean), "WED portal LOA/hiatus update");
    }
  }

  async function processDueLeaves() {
    const starting = (
      await q(`
        SELECT l.*,u.discord_role_ids
        FROM wed_leave_requests l
        JOIN wed_users u ON u.discord_user_id=l.user_id
        WHERE l.status='approved'
          AND COALESCE(l.starts_at_utc, l.starts_at::timestamp) <= NOW()
      `)
    ).rows;

    for (const leave of starting) {
      try {
        let previous = [];

        if (leave.requires_hiatus) {
          previous = (leave.discord_role_ids || []).filter(id => ACCESS_ROLE_IDS.includes(id));
          await changeMemberRoles(leave.user_id, {
            remove: previous,
            add: [ROLE_IDS.hiatus]
          });
          await q(
            "UPDATE wed_users SET access_state='hiatus',active=FALSE WHERE discord_user_id=$1",
            [leave.user_id]
          );
        }

        await q(`
          UPDATE wed_leave_requests
          SET status='active',previous_role_ids=$1,activated_at=NOW()
          WHERE id=$2 AND status='approved'
        `, [JSON.stringify(previous), leave.id]);

        await audit(null, "activate", "leave_request", leave.id, {
          automatic: true,
          requires_hiatus: leave.requires_hiatus
        });
      } catch (error) {
        console.error(`Could not activate leave ${leave.id}:`, error);
      }
    }

    const ending = (
      await q(`
        SELECT *
        FROM wed_leave_requests
        WHERE status IN ('approved','active')
          AND COALESCE(expected_return_at_utc, expected_return_at::timestamp) <= NOW()
      `)
    ).rows;

    for (const leave of ending) {
      try {
        if (leave.requires_hiatus) {
          await changeMemberRoles(leave.user_id, {
            remove: [ROLE_IDS.hiatus],
            add: leave.previous_role_ids || []
          });
          await q(
            "UPDATE wed_users SET access_state='no_access',active=TRUE WHERE discord_user_id=$1",
            [leave.user_id]
          );
        }

        const closed = await q(`
          UPDATE wed_leave_requests
          SET status='returned',returned_at=NOW()
          WHERE id=$1 AND status IN ('approved','active')
          RETURNING id
        `, [leave.id]);

        if (!closed.rows[0]) continue;

        await audit(null, "return", "leave_request", leave.id, { automatic: true });
        await sendLeaveChannelMessage(`🎉 Welcome back, <@${leave.user_id}>! Your approved leave has ended. We are glad to have you back.`);
        notify(client, "Staff returned from leave", `Leave request #${leave.id} ended automatically.`);
      } catch (error) {
        console.error(`Could not close leave ${leave.id}:`, error);
      }
    }
  }

  app.post("/settings/timezone", requireTeamLeadPlus, async (req, res) => {
    const timezone = String(req.body.timezone || "").trim();
    try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date()); }
    catch { return res.status(400).send("Invalid timezone."); }
    await q("UPDATE wed_users SET timezone=$1, timezone_confirmed_at=NOW() WHERE discord_user_id=$2", [timezone, req.user.discord_user_id]);
    req.user.timezone = timezone;
    res.redirect(req.body.return_to || "/loa");
  });

  app.get("/loa", requireTeamLeadPlus, async (req, res) => {
    const leadership = LEADERSHIP_ROLES.has(req.user.department_role);

    const own = await q(
      `
      SELECT l.*,u.display_name reviewer_name,r.display_name replacement_name
      FROM wed_leave_requests l
      LEFT JOIN wed_users u ON u.discord_user_id=l.reviewer_id
      LEFT JOIN wed_users r ON r.discord_user_id=l.temporary_replacement_id
      WHERE l.user_id=$1
      ORDER BY l.requested_at DESC
      `,
      [req.user.discord_user_id]
    );

    let pending = [];
    let users = [];

    if (leadership) {
      pending = (
        await q(`
          SELECT l.*,u.display_name,u.department_role,u.team
          FROM wed_leave_requests l
          JOIN wed_users u ON u.discord_user_id=l.user_id
          WHERE l.status IN ('pending','approved','active')
          ORDER BY l.requested_at DESC
        `)
      ).rows;

      users = (
        await q(`
          SELECT discord_user_id,display_name,department_role,team
          FROM wed_users
          WHERE active=TRUE AND access_state='active'
          ORDER BY display_name
        `)
      ).rows;
    }

    const ownCards = own.rows.map(item => `
      <article class="leave-card">
        <div class="record-topline">
          <div>
            <span class="record-kicker">${esc(pretty(item.leave_type))}</span>
            <h2>${esc(dateTimeInZone(item.starts_at_utc || item.starts_at, req.user.timezone))} – ${esc(dateTimeInZone(item.expected_return_at_utc || item.expected_return_at, req.user.timezone))}</h2>
          </div>
          ${badge(item.status)}
        </div>
        <p>${esc(item.reason)}</p>
        <div class="record-meta">
          <span>${item.requires_hiatus ? "Hiatus access rules apply" : "Standard LOA"}</span>
          ${item.reviewer_name ? `<span>Reviewed by ${esc(item.reviewer_name)}</span>` : ""}
        </div>
        ${["approved", "active"].includes(item.status)
          ? `<form method="post" action="/loa/${item.id}/return"><button class="small">Return from leave</button></form>`
          : ""}
        <div class="record-actions">${adminDeleteButton(req.user, "leave_request", item.id)}</div>
      </article>
    `).join("");

    const replacementOptions = users.map(user =>
      `<option value="${user.discord_user_id}">${esc(user.display_name)} (${esc(pretty(user.department_role))})</option>`
    ).join("");

    const reviewCards = pending.map(item => `
      <article class="review-card">
        <div class="record-topline">
          <div>
            <span class="record-kicker">${esc(item.display_name)}</span>
            <h2>${esc(dateTimeInZone(item.starts_at_utc || item.starts_at, req.user.timezone))} – ${esc(dateTimeInZone(item.expected_return_at_utc || item.expected_return_at, req.user.timezone))}</h2>
          </div>
          ${badge(item.status)}
        </div>
        <p>${esc(item.reason)}</p>
        <div class="record-meta">
          <span>${esc(pretty(item.department_role))}${item.team ? ` · ${esc(item.team)}` : ""}</span>
          <span>${item.requires_hiatus ? "Hiatus required" : "Standard LOA"}</span>
        </div>
        <div class="record-actions">${adminDeleteButton(req.user, "leave_request", item.id)}</div>
        ${item.status === "pending" ? `
          <form class="review-form" method="post" action="/loa/${item.id}/review">
            <label><span>Decision</span><select name="decision"><option value="approved">Approve</option><option value="denied">Deny</option></select></label>
            <label><span>Temporary replacement</span><select name="temporary_replacement_id"><option value="">No replacement</option>${replacementOptions}</select></label>
            ${textArea("Review notes", "reviewer_notes", "", false)}
            <div class="form-actions"><button class="primary">Submit decision</button></div>
          </form>
        ` : ""}
      </article>
    `).join("");

    const body = `
      ${flash(req)}
      ${pageTitle("Leave and availability", "STAFF AVAILABILITY", "Review staff leave requests submitted through Discord and manage returns.")}
      ${!req.user.timezone_confirmed_at ? `
        <section class="panel timezone-confirm" data-timezone-confirm>
          <h2>Confirm your timezone</h2>
          <p id="timezone-copy">We detected your timezone. Is this correct?</p>
          <form method="post" action="/settings/timezone">
            <input type="hidden" name="return_to" value="/loa">
            <label><span>Timezone</span><select name="timezone" id="timezone-select"></select></label>
            <button class="primary">Confirm timezone</button>
          </form>
        </section>
        <script>
          (() => { const detected=Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"; const select=document.getElementById("timezone-select"); const zones=[detected,"UTC","America/New_York","America/Chicago","America/Denver","America/Los_Angeles","Europe/London"].filter((v,i,a)=>a.indexOf(v)===i); zones.forEach(z=>{const o=document.createElement("option");o.value=z;o.textContent=z.replaceAll("_"," ");select.appendChild(o)}); document.getElementById("timezone-copy").textContent="We detected "+detected+". Is this your timezone? If not, select another."; })();
        </script>
      ` : ""}
      ${leadership ? `
        <section class="section-block">
          <div class="section-heading"><div><p class="eyebrow">LEADERSHIP REVIEW</p><h2>Pending and active leave</h2></div></div>
          <section class="record-grid">${reviewCards || emptyState("Nothing to review", "There are no pending or active leave requests.")}</section>
        </section>
      ` : ""}
    `;

    res.send(layout("Leave", body, req.user, "loa"));
  });

  app.post("/loa/:id/review", requireRole("team_lead"), async (req, res) => {
    const leave = (
      await q(
        `
        SELECT l.*,u.department_role,u.discord_role_ids,u.display_name
        FROM wed_leave_requests l
        JOIN wed_users u ON u.discord_user_id=l.user_id
        WHERE l.id=$1
        `,
        [req.params.id]
      )
    ).rows[0];

    if (!leave) return res.sendStatus(404);

    const decision = req.body.decision === "denied" ? "denied" : "approved";
    let status = decision;
    let previous = [];

    if (decision === "approved" && new Date(leave.starts_at) <= new Date()) {
      status = "active";

      if (leave.requires_hiatus) {
        previous = (leave.discord_role_ids || []).filter(id => ACCESS_ROLE_IDS.includes(id));
        await changeMemberRoles(leave.user_id, {
          remove: previous,
          add: [ROLE_IDS.hiatus]
        });
        await q(
          "UPDATE wed_users SET access_state='hiatus',active=FALSE WHERE discord_user_id=$1",
          [leave.user_id]
        );
      }
    }

    await q(
      `
      UPDATE wed_leave_requests
      SET status=$1,reviewer_id=$2,reviewer_notes=$3,temporary_replacement_id=$4,
          previous_role_ids=$5,reviewed_at=NOW(),
          activated_at=CASE WHEN $1='active' THEN NOW() ELSE activated_at END
      WHERE id=$6
      `,
      [
        status,
        req.user.discord_user_id,
        req.body.reviewer_notes || null,
        req.body.temporary_replacement_id || null,
        JSON.stringify(previous),
        req.params.id
      ]
    );

    await audit(req.user.discord_user_id, "review", "leave_request", req.params.id, {
      decision,
      status,
      requires_hiatus: leave.requires_hiatus
    });

    const startUnix = Math.floor(new Date(leave.starts_at_utc || leave.starts_at).getTime()/1000);
    const endUnix = Math.floor(new Date(leave.expected_return_at_utc || leave.expected_return_at).getTime()/1000);
    const note = req.body.reviewer_notes ? `\n**Leadership note:** ${req.body.reviewer_notes}` : "";
    await sendLeaveChannelMessage(`${decision === "approved" ? "✅" : "❌"} **Leave request ${decision}** for <@${leave.user_id}>.\n**Begins:** <t:${startUnix}:F>\n**Ends:** <t:${endUnix}:F>${note}`);
    notify(client, "LOA request reviewed", `#${req.params.id}: ${decision}`);
    res.redirect("/loa?ok=Leave%20request%20reviewed");
  });

  app.post("/loa/:id/return", requireLogin, async (req, res) => {
    const leave = (
      await q("SELECT * FROM wed_leave_requests WHERE id=$1", [req.params.id])
    ).rows[0];

    if (!leave) return res.sendStatus(404);

    const leadership = LEADERSHIP_ROLES.has(req.user.department_role);
    if (leave.user_id !== req.user.discord_user_id && !leadership) {
      return res.sendStatus(403);
    }

    if (leave.requires_hiatus) {
      await changeMemberRoles(leave.user_id, {
        remove: [ROLE_IDS.hiatus],
        add: leave.previous_role_ids || []
      });
      await q(
        "UPDATE wed_users SET access_state='active',active=TRUE WHERE discord_user_id=$1",
        [leave.user_id]
      );
    }

    await q(
      "UPDATE wed_leave_requests SET status='returned',returned_at=NOW() WHERE id=$1",
      [req.params.id]
    );

    await audit(req.user.discord_user_id, "return", "leave_request", req.params.id);
    await sendLeaveChannelMessage(`🎉 Welcome back, <@${leave.user_id}>! Your leave has ended. We are glad to have you back.`);
    notify(client, "Staff returned from leave", `Leave request #${req.params.id}`);
    res.redirect("/loa?ok=Return%20recorded");
  });

  app.get("/apply", (req, res) => {
    const body = `
      ${pageTitle("Apply to WED", "HIRING", "Tell us what you can contribute and where you fit best.")}
      <form class="panel form-grid" method="post" action="/apply">
        ${formField("Discord username", "discord_username")}
        ${formField("Discord user ID", "discord_user_id", "", "text", false)}
        ${formField("Roblox username", "roblox_username")}
        ${formField("Roblox user ID", "roblox_user_id", "", "text", false)}
        <label>
          <span>Position</span>
          <select name="position">
            <option>Developer</option>
            <option>Quality Control</option>
            <option>Concept Team</option>
            <option>3D Team</option>
          </select>
        </label>
        ${textArea("Why do you want to join?", "motivation")}
        ${textArea("Relevant experience or work samples", "experience")}
        ${textArea("Availability", "availability")}
        <label class="check field-span">
          <input type="checkbox" name="consent" required>
          <span>I have read the Privacy Policy and consent to WED using this information to evaluate my application.</span>
        </label>
        <div class="form-actions"><button class="primary">Submit application</button></div>
      </form>
    `;
    res.send(layout("Apply", body, req.user, "apply"));
  });

  app.post("/apply", async (req, res) => {
    if (!req.body.consent) return res.status(400).send("Consent is required.");

    const retention = new Date(Date.now() + 1000 * 60 * 60 * 24 * 180);
    const result = await q(
      `
      INSERT INTO wed_applications(
        discord_user_id,discord_username,roblox_username,roblox_user_id,
        position,answers,privacy_consent_at,retention_until
      )
      VALUES($1,$2,$3,$4,$5,$6,NOW(),$7)
      RETURNING id
      `,
      [
        req.body.discord_user_id || null,
        req.body.discord_username,
        req.body.roblox_username || null,
        req.body.roblox_user_id || null,
        req.body.position,
        {
          motivation: req.body.motivation,
          experience: req.body.experience,
          availability: req.body.availability
        },
        retention
      ]
    );

    await audit(req.body.discord_user_id || null, "submit", "application", result.rows[0].id);
    notify(client, "New WED application", `${req.body.discord_username} applied for ${req.body.position}.`);

    res.send(layout(
      "Application received",
      `
        <section class="success-screen">
          <span>APPLICATION #${result.rows[0].id}</span>
          <h1>Application submitted.</h1>
          <p>Your information has been delivered to the WED hiring pipeline.</p>
          <a class="button primary" href="/">Return home</a>
        </section>
      `
    ));
  });

  app.get("/hiring", requireRole("team_lead"), async (req, res) => {
    const applications = await q("SELECT * FROM wed_applications ORDER BY created_at DESC");

    const cards = applications.rows.map(item => {
      const answers = item.answers || {};
      return `
        <article class="application-card">
          <div class="record-topline">
            <div>
              <span class="record-kicker">Application #${item.id}</span>
              <h2>${esc(item.discord_username)}</h2>
            </div>
            ${badge(item.status)}
          </div>
          <div class="application-summary">
            <span><strong>Position</strong>${esc(item.position)}</span>
            <span><strong>Roblox</strong>${esc(item.roblox_username || "Not provided")}</span>
            <span><strong>Submitted</strong>${esc(date(item.created_at))}</span>
          </div>
          <details>
            <summary>View application responses</summary>
            <div class="answer-grid">
              <div><strong>Motivation</strong><p>${esc(answers.motivation || "—")}</p></div>
              <div><strong>Experience</strong><p>${esc(answers.experience || "—")}</p></div>
              <div><strong>Availability</strong><p>${esc(answers.availability || "—")}</p></div>
            </div>
          </details>
          <form class="review-form" method="post" action="/hiring/${item.id}">
            <label>
              <span>Move to</span>
              <select name="status">
                <option value="screening">Screening</option>
                <option value="background_check">Background check</option>
                <option value="interview">Interview</option>
                <option value="accepted">Accepted</option>
                <option value="denied">Denied</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </label>
            ${textArea("Reviewer notes", "reviewer_notes", item.reviewer_notes || "", false)}
            <div class="form-actions">
              <button class="primary">Update application</button>
              ${adminDeleteButton(req.user, "application", item.id)}
            </div>
          </form>
        </article>
      `;
    }).join("");

    const body = `
      ${pageTitle("Hiring pipeline", "HIRING", "Review applicants, preserve notes, and move candidates through each stage.")}
      <section class="record-grid">
        ${cards || emptyState("No applications", "Submitted applications will appear here.")}
      </section>
    `;

    res.send(layout("Hiring", body, req.user, "hiring"));
  });

  app.post("/hiring/:id", requireRole("team_lead"), async (req, res) => {
    await q(
      `
      UPDATE wed_applications
      SET status=$1,reviewer_id=$2,reviewer_notes=$3,updated_at=NOW()
      WHERE id=$4
      `,
      [
        req.body.status,
        req.user.discord_user_id,
        req.body.reviewer_notes || null,
        req.params.id
      ]
    );

    await audit(req.user.discord_user_id, "update", "application", req.params.id, {
      status: req.body.status
    });

    res.redirect("/hiring");
  });

  app.get("/background-checks", requireRole("secretary"), async (req, res) => {
    const result = await q(`
      SELECT
        b.*,
        s.public_status,
        s.published_at,
        s.viewed_at,
        s.subject_discord_id AS report_subject_id,
        u.display_name AS investigator_name,
        COUNT(DISTINCT n.id) AS note_count,
        COUNT(DISTINCT e.id) AS evidence_count,
        COUNT(DISTINCT a.id) FILTER (WHERE a.status='pending') AS pending_appeals
      FROM wed_background_checks b
      LEFT JOIN wed_ia_case_settings s ON s.case_id=b.id
      LEFT JOIN wed_users u ON u.discord_user_id=b.investigator_id
      LEFT JOIN wed_ia_notes n ON n.case_id=b.id
      LEFT JOIN wed_ia_evidence e ON e.case_id=b.id
      LEFT JOIN wed_ia_appeals a ON a.case_id=b.id
      GROUP BY b.id,s.case_id,u.display_name
      ORDER BY
        CASE
          WHEN b.status='awaiting_review' THEN 0
          WHEN b.status='draft' THEN 1
          ELSE 2
        END,
        b.created_at DESC
    `);

    const counts = result.rows.reduce((map, item) => {
      map[item.status] = (map[item.status] || 0) + 1;
      if (item.public_status === "published") map.published = (map.published || 0) + 1;
      map.appeals = (map.appeals || 0) + Number(item.pending_appeals || 0);
      return map;
    }, {});

    const cards = result.rows.map(item => `
      <article class="case-card">
        <div class="case-id">IA-${String(item.id).padStart(4, "0")}</div>
        <div class="case-main">
          <div class="record-topline">
            <div>
              <span class="record-kicker">${esc(item.reason)}</span>
              <h2>${esc(item.subject_username)}</h2>
            </div>
            <div class="badge-stack">
              ${badge(item.status)}
              ${item.public_status === "published" ? badge("published") : badge("internal_only")}
            </div>
          </div>
          <div class="record-meta">
            <span>Investigator: ${esc(item.investigator_name || "Unassigned")}</span>
            <span>${Number(item.note_count)} notes</span>
            <span>${Number(item.evidence_count)} evidence items</span>
            ${Number(item.pending_appeals) ? `<span>${Number(item.pending_appeals)} pending appeal</span>` : ""}
            ${item.viewed_at ? `<span>Subject viewed ${esc(dateTime(item.viewed_at))}</span>` : ""}
          </div>
          <p>${esc(item.outcome_summary || "No internal outcome has been recorded yet.")}</p>
          <div class="record-actions">
            <a class="button primary small" href="/background-checks/${item.id}">Open case</a>
            ${adminDeleteButton(req.user, "ia_case", item.id, "Delete case")}
          </div>
        </div>
      </article>
    `).join("");

    const body = `
      ${flash(req)}
      ${pageTitle(
        "Internal Affairs",
        "CASE MANAGEMENT",
        "Private investigation workspace, controlled subject reports, evidence, appeals, and audit-ready timelines.",
        `<a class="button primary" href="/background-checks/new">Open case</a>`
      )}
      <section class="metrics-grid compact-metrics">
        ${metric("Awaiting review", counts.awaiting_review || 0)}
        ${metric("Draft", counts.draft || 0)}
        ${metric("Published", counts.published || 0)}
        ${metric("Pending appeals", counts.appeals || 0)}
        ${metric("Closed", (counts.approved || 0) + (counts.denied || 0) + (counts.blocked || 0))}
      </section>
      <section class="case-list">
        ${cards || emptyState("No IA cases", "Opened investigations and background checks will appear here.", `<a class="button primary" href="/background-checks/new">Open the first case</a>`)}
      </section>
    `;

    res.send(layout("Internal Affairs", body, req.user, "ia"));
  });

  app.get("/background-checks/new", requireRole("secretary"), async (req, res) => {
    await syncGuildMembers(client).catch(console.error);

    const users = (
      await q(`
        SELECT discord_user_id,display_name,discord_username
        FROM wed_users
        WHERE active=TRUE
        ORDER BY LOWER(display_name)
      `)
    ).rows;

    const options = users.map(user =>
      `<option value="${user.discord_user_id}">${esc(user.display_name || user.discord_username)}</option>`
    ).join("");

    const body = `
      ${pageTitle("Open an IA case", "INTERNAL AFFAIRS", "Create the internal case first. A subject-facing report can be prepared and published later.")}
      <form class="panel form-grid" method="post" action="/background-checks">
        <div class="form-section field-span">
          <span>01</span><div><strong>Subject</strong><p>Select the Discord account that may later receive the published report.</p></div>
        </div>
        <label>
          <span>Discord subject</span>
          <select name="subject_discord_id" required>
            <option value="" selected disabled>Select a server member</option>
            ${options}
          </select>
        </label>
        ${formField("Subject username", "subject_username")}
        ${formField("Subject Roblox ID", "subject_roblox_id", "", "text", false)}
        ${formField("Subject WEI rank", "subject_wei_rank", "", "text", false)}
        <div class="form-section field-span">
          <span>02</span><div><strong>Case information</strong><p>Define why the review exists and who requested it.</p></div>
        </div>
        ${formField("Requestee username", "requestee_username")}
        ${formField("Requestee Roblox ID", "requestee_roblox_id", "", "text", false)}
        <label>
          <span>Case type</span>
          <select name="reason">
            <option>Hiring Background Check</option>
            <option>Internal Investigation</option>
            <option>Security Concern</option>
            <option>Appeal Review</option>
            <option>Leadership Request</option>
            <option>Other</option>
          </select>
        </label>
        <div class="form-section field-span">
          <span>03</span><div><strong>Initial internal findings</strong><p>These fields remain internal unless copied into the subject report later.</p></div>
        </div>
        ${textArea("Friends of interest", "friends_of_interest", "None found.", false)}
        ${textArea("Groups of interest", "groups_of_interest", "None found.", false)}
        ${textArea("Discord server activity", "discord_activity_review", "", false)}
        ${textArea("Discord profile review", "discord_profile_review", "", false)}
        ${textArea("Major infractions", "major_infractions", "None found.", false)}
        ${textArea("Minor infractions", "minor_infractions", "None found.", false)}
        ${textArea("Internal outcome and recommendation", "outcome_summary", "", false)}
        <label>
          <span>Internal status</span>
          <select name="status">
            <option value="draft">Draft</option>
            <option value="evidence_collection">Evidence collection</option>
            <option value="interviewing">Interviewing</option>
            <option value="awaiting_review">Supervisor review</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
            <option value="blocked">Blocked</option>
          </select>
        </label>
        <label class="check field-span">
          <input type="checkbox" name="certify">
          <span>I certify the initial case entry is objective and role-relevant.</span>
        </label>
        <div class="form-actions">
          <button class="primary">Create internal case</button>
          <a class="button ghost" href="/background-checks">Cancel</a>
        </div>
      </form>
    `;

    res.send(layout("Open IA Case", body, req.user, "ia"));
  });

  app.post("/background-checks", requireRole("secretary"), async (req, res) => {
    const retention = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);

    const result = await q(
      `
      INSERT INTO wed_background_checks(
        subject_username,subject_discord_id,subject_roblox_id,subject_wei_rank,
        requestee_username,requestee_roblox_id,reason,status,outcome_summary,
        friends_of_interest,groups_of_interest,discord_activity_review,
        discord_profile_review,major_infractions,minor_infractions,
        investigator_id,certified_at,retention_until
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING id
      `,
      [
        req.body.subject_username,
        req.body.subject_discord_id || null,
        req.body.subject_roblox_id || null,
        req.body.subject_wei_rank || null,
        req.body.requestee_username,
        req.body.requestee_roblox_id || null,
        req.body.reason,
        req.body.status,
        req.body.outcome_summary || null,
        req.body.friends_of_interest || null,
        req.body.groups_of_interest || null,
        req.body.discord_activity_review || null,
        req.body.discord_profile_review || null,
        req.body.major_infractions || null,
        req.body.minor_infractions || null,
        req.user.discord_user_id,
        req.body.certify ? new Date() : null,
        retention
      ]
    );

    await q(
      `INSERT INTO wed_ia_case_settings(case_id,subject_discord_id)
       VALUES($1,$2)
       ON CONFLICT(case_id) DO UPDATE SET subject_discord_id=EXCLUDED.subject_discord_id,updated_at=NOW()`,
      [result.rows[0].id, req.body.subject_discord_id]
    );

    await addIaTimeline(
      result.rows[0].id,
      req.user.discord_user_id,
      "case_opened",
      `Case opened by ${req.user.display_name || req.user.discord_username}.`,
      false
    );

    await audit(req.user.discord_user_id, "create", "background_check", result.rows[0].id, {
      status: req.body.status
    });

    notify(client, "IA case created", `IA-${result.rows[0].id} for ${req.body.subject_username}: ${req.body.status}`);
    res.redirect(`/background-checks/${result.rows[0].id}`);
  });

  app.get("/background-checks/:id", requireRole("secretary"), async (req, res) => {
    const item = await getIaCase(req.params.id);
    if (!item) return res.sendStatus(404);

    const [notes, evidence, timeline, appeals] = await Promise.all([
      q(`
        SELECT n.*,u.display_name AS author_name
        FROM wed_ia_notes n
        LEFT JOIN wed_users u ON u.discord_user_id=n.author_id
        WHERE n.case_id=$1
        ORDER BY n.created_at DESC
      `, [req.params.id]),
      q(`
        SELECT e.*,u.display_name AS added_by_name
        FROM wed_ia_evidence e
        LEFT JOIN wed_users u ON u.discord_user_id=e.added_by
        WHERE e.case_id=$1
        ORDER BY e.created_at DESC
      `, [req.params.id]),
      q(`
        SELECT t.*,u.display_name AS actor_name
        FROM wed_ia_timeline t
        LEFT JOIN wed_users u ON u.discord_user_id=t.actor_id
        WHERE t.case_id=$1
        ORDER BY t.created_at DESC
      `, [req.params.id]),
      q(`
        SELECT a.*,u.display_name AS appellant_name,r.display_name AS reviewer_name
        FROM wed_ia_appeals a
        LEFT JOIN wed_users u ON u.discord_user_id=a.appellant_id
        LEFT JOIN wed_users r ON r.discord_user_id=a.reviewer_id
        WHERE a.case_id=$1
        ORDER BY a.created_at DESC
      `, [req.params.id])
    ]);

    const noteCards = notes.rows.map(note => `
      <article class="note-card ${note.visible_to_subject ? "shareable" : "internal"}">
        <div class="record-topline">
          <div><span class="record-kicker">${esc(pretty(note.note_type))}</span><h3>${esc(note.author_name || "System")}</h3></div>
          ${note.visible_to_subject ? badge("subject_visible") : badge("internal")}
        </div>
        <p>${esc(note.body)}</p>
        <small>${esc(dateTime(note.created_at))}</small>
        <div class="record-actions">${adminDeleteButton(req.user, "ia_note", note.id)}</div>
      </article>
    `).join("");

    const evidenceCards = evidence.rows.map(record => `
      <article class="evidence-card">
        <div class="record-topline">
          <div><span class="record-kicker">${esc(pretty(record.evidence_type))}</span><h3>${esc(record.label)}</h3></div>
          ${record.visible_to_subject ? badge("subject_visible") : badge("internal")}
        </div>
        <p>${esc(record.description || "No description.")}</p>
        <div class="record-meta"><span>Added by ${esc(record.added_by_name || "Unknown")}</span><span>${esc(dateTime(record.created_at))}</span></div>
        <div class="record-actions">
          ${record.url ? `<a class="button ghost small" href="${esc(record.url)}">Open evidence</a>` : ""}
          ${adminDeleteButton(req.user, "ia_evidence", record.id)}
        </div>
      </article>
    `).join("");

    const timelineItems = timeline.rows.map(event => `
      <article class="timeline-item">
        <div class="timeline-dot"></div>
        <div>
          <span>${esc(dateTime(event.created_at))}</span>
          <strong>${esc(pretty(event.event_type))}</strong>
          <p>${esc(event.description)}</p>
        </div>
      </article>
    `).join("");

    const appealCards = appeals.rows.map(appeal => `
      <article class="appeal-card">
        <div class="record-topline">
          <div><span class="record-kicker">Appeal #${appeal.id}</span><h3>${esc(appeal.appellant_name || appeal.appellant_id)}</h3></div>
          ${badge(appeal.status)}
        </div>
        <p>${esc(appeal.reason)}</p>
        ${appeal.evidence_url ? `<a class="button ghost small" href="${esc(appeal.evidence_url)}">Appeal evidence</a>` : ""}
        <div class="record-actions">${adminDeleteButton(req.user, "ia_appeal", appeal.id)}</div>
        ${appeal.status === "pending" ? `
          <form class="review-form" method="post" action="/background-checks/${item.id}/appeals/${appeal.id}">
            <label><span>Decision</span><select name="status"><option value="approved">Grant appeal</option><option value="denied">Deny appeal</option><option value="closed">Close without action</option></select></label>
            ${textArea("Decision notes", "decision_notes", "", false)}
            <div class="form-actions"><button class="primary">Complete appeal review</button></div>
          </form>
        ` : `<p><strong>Decision:</strong> ${esc(appeal.decision_notes || "No decision notes.")}</p>`}
      </article>
    `).join("");

    const body = `
      ${flash(req)}
      ${pageTitle(
        `IA-${String(item.id).padStart(4, "0")}`,
        "INTERNAL AFFAIRS CASE",
        `${item.subject_username} · ${item.reason}`,
        `<a class="button ghost" href="/background-checks">Back to cases</a>`
      )}

      <section class="case-detail-grid">
        <aside class="panel case-sidebar">
          <div><span>Internal status</span>${badge(item.status)}</div>
          <div><span>Subject</span><strong>${esc(item.subject_username)}</strong></div>
          <div><span>Discord ID</span><strong>${esc(item.report_subject_id || item.subject_discord_id || "—")}</strong></div>
          <div><span>Investigator</span><strong>${esc(item.investigator_name || "Unassigned")}</strong></div>
          <div><span>Subject report</span>${item.public_status === "published" ? badge("published") : badge("draft")}</div>
          <div><span>Published</span><strong>${esc(dateTime(item.published_at))}</strong></div>
          <div><span>Viewed</span><strong>${esc(dateTime(item.viewed_at))}</strong></div>
          <div><span>Retention review</span><strong>${esc(date(item.retention_until))}</strong></div>
        </aside>

        <div class="case-content">
          <details open class="panel detail-block">
            <summary>Internal findings</summary>
            <h3>Outcome and recommendation</h3><p>${esc(item.outcome_summary || "No outcome recorded.")}</p>
            <h3>Discord activity</h3><p>${esc(item.discord_activity_review || "No findings recorded.")}</p>
            <h3>Discord profile</h3><p>${esc(item.discord_profile_review || "No findings recorded.")}</p>
            <h3>Friends of interest</h3><p>${esc(item.friends_of_interest || "None found.")}</p>
            <h3>Groups of interest</h3><p>${esc(item.groups_of_interest || "None found.")}</p>
            <h3>Major infractions</h3><p>${esc(item.major_infractions || "None found.")}</p>
            <h3>Minor infractions</h3><p>${esc(item.minor_infractions || "None found.")}</p>
          </details>

          <section class="panel">
            <div class="section-heading"><div><p class="eyebrow">PRIVATE WORKSPACE</p><h2>Internal notes</h2></div></div>
            <form class="form-grid" method="post" action="/background-checks/${item.id}/notes">
              <label><span>Note type</span><select name="note_type"><option value="investigator">Investigator note</option><option value="supervisor">Supervisor note</option><option value="director">Director note</option><option value="interview">Interview note</option></select></label>
              <label class="check"><input type="checkbox" name="visible_to_subject"><span>May be shown in the subject report</span></label>
              ${textArea("Note", "body")}
              <div class="form-actions"><button class="primary">Add note</button></div>
            </form>
            <div class="note-grid">${noteCards || `<p class="muted">No notes yet.</p>`}</div>
          </section>

          <section class="panel">
            <div class="section-heading"><div><p class="eyebrow">EVIDENCE</p><h2>Evidence locker</h2></div></div>
            <form class="form-grid" method="post" action="/background-checks/${item.id}/evidence">
              ${formField("Label", "label")}
              <label><span>Type</span><select name="evidence_type"><option value="discord_message">Discord message</option><option value="image">Image</option><option value="video">Video</option><option value="pdf">PDF</option><option value="google_drive">Google Drive</option><option value="url">Other URL</option><option value="note">Evidence note</option></select></label>
              ${formField("URL", "url", "", "url", false)}
              ${textArea("Description", "description", "", false)}
              <label class="check"><input type="checkbox" name="visible_to_subject"><span>Include in the subject report</span></label>
              <div class="form-actions"><button class="primary">Add evidence</button></div>
            </form>
            <div class="evidence-grid">${evidenceCards || `<p class="muted">No evidence items yet.</p>`}</div>
          </section>

          <section class="panel">
            <div class="section-heading"><div><p class="eyebrow">SUBJECT COPY</p><h2>Prepare and publish report</h2></div></div>
            <form class="form-grid" method="post" action="/background-checks/${item.id}/publish">
              ${textArea("Public summary", "public_summary", item.public_summary || "", false)}
              ${textArea("Findings", "public_findings", item.public_findings || "", false)}
              ${textArea("Policy violations", "public_policy_violations", item.public_policy_violations || "", false)}
              ${textArea("Final outcome", "public_outcome", item.public_outcome || "", false)}
              ${textArea("Appeal information", "public_appeal_info", item.public_appeal_info || "You may submit an appeal through this portal.", false)}
              ${formField("Appeal deadline", "appeal_deadline", item.appeal_deadline ? new Date(item.appeal_deadline).toISOString().slice(0,16) : "", "datetime-local", false)}
              <label class="check"><input type="checkbox" name="allow_appeal" ${item.allow_appeal !== false ? "checked" : ""}><span>Allow the subject to appeal</span></label>
              <div class="publication-warning field-span">
                <strong>Publishing sends a Discord DM.</strong>
                <p>The subject will receive a private link and must authenticate with the matching Discord account.</p>
              </div>
              <div class="form-actions">
                <button class="primary" name="action" value="publish">${item.public_status === "published" ? "Update published report" : "Publish and DM subject"}</button>
                ${item.public_status === "published" ? `<button class="danger" name="action" value="unpublish">Unpublish report</button>` : ""}
              </div>
            </form>
          </section>

          <section class="panel">
            <div class="section-heading"><div><p class="eyebrow">TIMELINE</p><h2>Case history</h2></div></div>
            <div class="timeline">${timelineItems || `<p class="muted">No timeline events.</p>`}</div>
          </section>

          <section class="panel">
            <div class="section-heading"><div><p class="eyebrow">APPEALS</p><h2>Subject appeals</h2></div></div>
            <div class="record-grid compact-grid">${appealCards || `<p class="muted">No appeals submitted.</p>`}</div>
          </section>

          <form class="panel review-form" method="post" action="/background-checks/${item.id}/status">
            <div class="section-heading"><div><p class="eyebrow">INTERNAL CASE ACTION</p><h2>Update internal status</h2></div></div>
            <label><span>Status</span><select name="status"><option value="draft">Draft</option><option value="evidence_collection">Evidence collection</option><option value="interviewing">Interviewing</option><option value="awaiting_review">Supervisor review</option><option value="approved">Approved</option><option value="denied">Denied</option><option value="blocked">Blocked</option><option value="closed">Closed</option><option value="archived">Archived</option></select></label>
            ${textArea("Updated internal outcome", "outcome_summary", item.outcome_summary || "", false)}
            <div class="form-actions"><button class="primary">Save internal update</button></div>
          </form>
        </div>
      </section>
    `;

    res.send(layout(`IA-${item.id}`, body, req.user, "ia"));
  });

  app.post("/background-checks/:id/notes", requireRole("secretary"), async (req, res) => {
    await q(
      `INSERT INTO wed_ia_notes(case_id,author_id,note_type,body,visible_to_subject)
       VALUES($1,$2,$3,$4,$5)`,
      [req.params.id, req.user.discord_user_id, req.body.note_type, req.body.body, Boolean(req.body.visible_to_subject)]
    );
    await addIaTimeline(req.params.id, req.user.discord_user_id, "note_added", `${pretty(req.body.note_type)} added.`, false);
    await audit(req.user.discord_user_id, "create", "ia_note", req.params.id);
    res.redirect(`/background-checks/${req.params.id}?ok=Internal%20note%20added`);
  });

  app.post("/background-checks/:id/evidence", requireRole("secretary"), async (req, res) => {
    await q(
      `INSERT INTO wed_ia_evidence(case_id,added_by,label,evidence_type,url,description,visible_to_subject)
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [req.params.id, req.user.discord_user_id, req.body.label, req.body.evidence_type, req.body.url || null, req.body.description || null, Boolean(req.body.visible_to_subject)]
    );
    await addIaTimeline(req.params.id, req.user.discord_user_id, "evidence_added", `Evidence added: ${req.body.label}.`, false);
    await audit(req.user.discord_user_id, "create", "ia_evidence", req.params.id);
    res.redirect(`/background-checks/${req.params.id}?ok=Evidence%20added`);
  });

  app.post("/background-checks/:id/publish", requireRole("secretary"), async (req, res) => {
    const item = await getIaCase(req.params.id);
    if (!item) return res.sendStatus(404);

    if (req.body.action === "unpublish") {
      await q(
        `UPDATE wed_ia_case_settings
         SET public_status='draft',updated_at=NOW()
         WHERE case_id=$1`,
        [req.params.id]
      );
      await addIaTimeline(req.params.id, req.user.discord_user_id, "report_unpublished", "Subject report unpublished.", false);
      await audit(req.user.discord_user_id, "unpublish", "ia_report", req.params.id);
      return res.redirect(`/background-checks/${req.params.id}?ok=Subject%20report%20unpublished`);
    }

    await q(
      `
      INSERT INTO wed_ia_case_settings(
        case_id,subject_discord_id,public_status,public_summary,public_findings,
        public_policy_violations,public_outcome,public_appeal_info,allow_appeal,
        appeal_deadline,published_at,published_by,updated_at
      )
      VALUES($1,$2,'published',$3,$4,$5,$6,$7,$8,$9,NOW(),$10,NOW())
      ON CONFLICT(case_id) DO UPDATE SET
        subject_discord_id=EXCLUDED.subject_discord_id,
        public_status='published',
        public_summary=EXCLUDED.public_summary,
        public_findings=EXCLUDED.public_findings,
        public_policy_violations=EXCLUDED.public_policy_violations,
        public_outcome=EXCLUDED.public_outcome,
        public_appeal_info=EXCLUDED.public_appeal_info,
        allow_appeal=EXCLUDED.allow_appeal,
        appeal_deadline=EXCLUDED.appeal_deadline,
        published_at=NOW(),
        published_by=EXCLUDED.published_by,
        updated_at=NOW()
      `,
      [
        req.params.id,
        item.report_subject_id || item.subject_discord_id,
        req.body.public_summary || null,
        req.body.public_findings || null,
        req.body.public_policy_violations || null,
        req.body.public_outcome || null,
        req.body.public_appeal_info || null,
        Boolean(req.body.allow_appeal),
        req.body.appeal_deadline || null,
        req.user.discord_user_id
      ]
    );

    await addIaTimeline(req.params.id, req.user.discord_user_id, "report_published", "Subject report published and notification attempted.", true);
    await audit(req.user.discord_user_id, "publish", "ia_report", req.params.id);

    const reportUrl = `${process.env.BASE_URL || "https://wed.ope674c.dev"}/my-reports/${req.params.id}`;

    try {
      const subject = await client.users.fetch(item.report_subject_id || item.subject_discord_id);
      await subject.send({
        embeds: [{
          title: `WED Internal Affairs Report IA-${String(item.id).padStart(4, "0")}`,
          description: `A subject-facing Internal Affairs report is available for you.

You must sign in with this Discord account to view it.`,
          color: 0x7c5cff,
          fields: [
            { name: "Case", value: `IA-${String(item.id).padStart(4, "0")}`, inline: true },
            { name: "Status", value: "Published", inline: true }
          ],
          timestamp: new Date().toISOString()
        }],
        components: [{
          type: 1,
          components: [{
            type: 2,
            style: 5,
            label: "View report",
            url: reportUrl
          }]
        }]
      });
    } catch (error) {
      console.error(`Could not DM IA report ${item.id}:`, error);
    }

    res.redirect(`/background-checks/${req.params.id}?ok=Subject%20report%20published`);
  });

  app.post("/background-checks/:id/status", requireRole("secretary"), async (req, res) => {
    await q(
      `UPDATE wed_background_checks
       SET status=$1,outcome_summary=$2,updated_at=NOW()
       WHERE id=$3`,
      [req.body.status, req.body.outcome_summary || null, req.params.id]
    );
    await addIaTimeline(req.params.id, req.user.discord_user_id, "status_changed", `Internal status changed to ${pretty(req.body.status)}.`, false);
    await audit(req.user.discord_user_id, "update", "background_check", req.params.id, { status: req.body.status });
    res.redirect(`/background-checks/${req.params.id}?ok=Internal%20case%20updated`);
  });

  app.post("/background-checks/:caseId/appeals/:appealId", requireRole("secretary"), async (req, res) => {
    await q(
      `UPDATE wed_ia_appeals
       SET status=$1,reviewer_id=$2,decision_notes=$3,reviewed_at=NOW()
       WHERE id=$4 AND case_id=$5`,
      [req.body.status, req.user.discord_user_id, req.body.decision_notes || null, req.params.appealId, req.params.caseId]
    );
    await addIaTimeline(req.params.caseId, req.user.discord_user_id, "appeal_reviewed", `Appeal #${req.params.appealId} marked ${pretty(req.body.status)}.`, true);
    await audit(req.user.discord_user_id, "review", "ia_appeal", req.params.appealId, { status: req.body.status });
    res.redirect(`/background-checks/${req.params.caseId}?ok=Appeal%20reviewed`);
  });

  app.get("/my-reports", requireLogin, async (req, res) => {
    const result = await q(
      `
      SELECT b.id,b.subject_username,b.reason,b.status,s.public_status,s.public_outcome,
             s.published_at,s.viewed_at,s.allow_appeal,s.appeal_deadline
      FROM wed_background_checks b
      JOIN wed_ia_case_settings s ON s.case_id=b.id
      WHERE s.subject_discord_id=$1 AND s.public_status='published'
      ORDER BY s.published_at DESC
      `,
      [req.user.discord_user_id]
    );

    const cards = result.rows.map(item => `
      <article class="report-card">
        <div class="record-topline">
          <div><span class="record-kicker">IA-${String(item.id).padStart(4, "0")}</span><h2>${esc(item.reason)}</h2></div>
          ${badge("published")}
        </div>
        <p>${esc(item.public_outcome || "A report is available for review.")}</p>
        <div class="record-meta"><span>Published ${esc(dateTime(item.published_at))}</span>${item.viewed_at ? `<span>Viewed ${esc(dateTime(item.viewed_at))}</span>` : `<span>Unread</span>`}</div>
        <div class="record-actions"><a class="button primary small" href="/my-reports/${item.id}">View report</a></div>
      </article>
    `).join("");

    const body = `
      ${pageTitle(
        req.user.access_state === "suspended" ? "My cases" : "My IA reports",
        "PRIVATE CASES",
        "Internal Affairs cases published specifically to your Discord account."
      )}
      <section class="record-grid">${cards || emptyState("No published reports", "No Internal Affairs reports are currently available to this account.")}</section>
    `;

    res.send(layout(req.user.access_state === "suspended" ? "My Cases" : "My IA Reports", body, req.user, "reports"));
  });

  app.get("/my-reports/:id", requireLogin, async (req, res) => {
    const item = await getIaCase(req.params.id);
    if (!item || item.public_status !== "published" || item.report_subject_id !== req.user.discord_user_id) {
      return res.status(403).send(accessDeniedPage(req.user, "This report was not published to your Discord account."));
    }

    const [notes, evidence, timeline, appeal] = await Promise.all([
      q(`SELECT * FROM wed_ia_notes WHERE case_id=$1 AND visible_to_subject=TRUE ORDER BY created_at`, [req.params.id]),
      q(`SELECT * FROM wed_ia_evidence WHERE case_id=$1 AND visible_to_subject=TRUE ORDER BY created_at`, [req.params.id]),
      q(`SELECT * FROM wed_ia_timeline WHERE case_id=$1 AND visible_to_subject=TRUE ORDER BY created_at`, [req.params.id]),
      q(`SELECT * FROM wed_ia_appeals WHERE case_id=$1 AND appellant_id=$2 ORDER BY created_at DESC LIMIT 1`, [req.params.id, req.user.discord_user_id])
    ]);

    if (!item.viewed_at) {
      await q(`UPDATE wed_ia_case_settings SET viewed_at=NOW(),updated_at=NOW() WHERE case_id=$1`, [req.params.id]);
      await addIaTimeline(req.params.id, req.user.discord_user_id, "report_viewed", "Subject viewed the published report.", false);
    }

    const publicNotes = notes.rows.map(note => `<article class="public-section"><h3>${esc(pretty(note.note_type))}</h3><p>${esc(note.body)}</p></article>`).join("");
    const publicEvidence = evidence.rows.map(record => `<article class="evidence-card"><span class="record-kicker">${esc(pretty(record.evidence_type))}</span><h3>${esc(record.label)}</h3><p>${esc(record.description || "")}</p>${record.url ? `<a class="button ghost small" href="${esc(record.url)}">Open evidence</a>` : ""}</article>`).join("");
    const publicTimeline = timeline.rows.map(event => `<article class="timeline-item"><div class="timeline-dot"></div><div><span>${esc(dateTime(event.created_at))}</span><strong>${esc(pretty(event.event_type))}</strong><p>${esc(event.description)}</p></div></article>`).join("");

    const appealOpen = item.allow_appeal &&
      (!item.appeal_deadline || new Date(item.appeal_deadline) > new Date()) &&
      !appeal.rows[0];

    const appealPanel = appeal.rows[0]
      ? `<section class="panel"><p class="eyebrow">APPEAL</p><h2>Your appeal</h2>${badge(appeal.rows[0].status)}<p>${esc(appeal.rows[0].reason)}</p>${appeal.rows[0].decision_notes ? `<p><strong>Decision:</strong> ${esc(appeal.rows[0].decision_notes)}</p>` : ""}</section>`
      : appealOpen
        ? `<section class="panel"><p class="eyebrow">APPEAL</p><h2>Appeal this report</h2><p>${esc(item.public_appeal_info || "You may submit an appeal below.")}</p><form class="form-grid" method="post" action="/my-reports/${item.id}/appeal">${textArea("Reason for appeal", "reason")}${formField("Evidence URL", "evidence_url", "", "url", false)}<div class="form-actions"><button class="primary">Submit appeal</button></div></form></section>`
        : `<section class="panel"><p class="eyebrow">APPEAL</p><h2>Appeal unavailable</h2><p>This report is not currently eligible for appeal.</p></section>`;

    const body = `
      ${pageTitle(`IA-${String(item.id).padStart(4, "0")}`, "YOUR INTERNAL AFFAIRS REPORT", `${item.reason} · Published ${date(item.published_at)}`, `<a class="button ghost" href="/my-reports">All cases</a>`)}
      <section class="public-report">
        <article class="public-section"><span>Summary</span><p>${esc(item.public_summary || "No summary provided.")}</p></article>
        <article class="public-section"><span>Findings</span><p>${esc(item.public_findings || "No findings provided.")}</p></article>
        <article class="public-section"><span>Policy violations</span><p>${esc(item.public_policy_violations || "None listed.")}</p></article>
        <article class="public-section outcome"><span>Final outcome</span><p>${esc(item.public_outcome || "No outcome provided.")}</p></article>
        ${publicNotes}
      </section>
      ${publicEvidence ? `<section class="panel"><p class="eyebrow">SHARED EVIDENCE</p><h2>Evidence included with this report</h2><div class="evidence-grid">${publicEvidence}</div></section>` : ""}
      ${publicTimeline ? `<section class="panel"><p class="eyebrow">TIMELINE</p><h2>Published case history</h2><div class="timeline">${publicTimeline}</div></section>` : ""}
      ${appealPanel}
    `;

    res.send(layout(`IA-${item.id}`, body, req.user, "reports"));
  });

  app.post("/my-reports/:id/appeal", requireLogin, async (req, res) => {
    const item = await getIaCase(req.params.id);
    if (!item || item.public_status !== "published" || item.report_subject_id !== req.user.discord_user_id) {
      return res.sendStatus(403);
    }

    if (!item.allow_appeal || (item.appeal_deadline && new Date(item.appeal_deadline) <= new Date())) {
      return res.status(400).send("Appeal period is closed.");
    }

    const existing = await q(
      `SELECT id FROM wed_ia_appeals WHERE case_id=$1 AND appellant_id=$2`,
      [req.params.id, req.user.discord_user_id]
    );
    if (existing.rows[0]) return res.status(409).send("An appeal has already been submitted.");

    const result = await q(
      `INSERT INTO wed_ia_appeals(case_id,appellant_id,reason,evidence_url)
       VALUES($1,$2,$3,$4) RETURNING id`,
      [req.params.id, req.user.discord_user_id, req.body.reason, req.body.evidence_url || null]
    );

    await addIaTimeline(req.params.id, req.user.discord_user_id, "appeal_submitted", `Appeal #${result.rows[0].id} submitted by the subject.`, true);
    await audit(req.user.discord_user_id, "submit", "ia_appeal", result.rows[0].id);
    notify(client, "New IA appeal", `IA-${req.params.id}: appeal #${result.rows[0].id} submitted.`);
    res.redirect(`/my-reports/${req.params.id}?ok=Appeal%20submitted`);
  });


  app.get("/staff-management", requireTeamLeadPlus, async (req, res) => {
    const [openCycles, pendingDiscipline, moderationCount, recentCycle] = await Promise.all([
      q(`SELECT COUNT(*) FROM wed_pay_cycles WHERE status IN ('draft','open','review')`),
      q(`SELECT COUNT(*) FROM wed_punishments WHERE status='pending'`),
      q(`SELECT COUNT(*) FROM wed_moderation_records`),
      q(`SELECT * FROM wed_pay_cycles ORDER BY created_at DESC LIMIT 1`)
    ]);

    const lastCycle = recentCycle.rows[0];

    const body = `
      ${pageTitle(
        "Staff Management",
        "STAFF OPERATIONS",
        "Discipline, pay cycles, and internal moderation records in one controlled workspace."
      )}

      <section class="metrics-grid compact-metrics">
        ${metric("Open pay cycles", openCycles.rows[0].count)}
        ${metric("Pending discipline", pendingDiscipline.rows[0].count)}
        ${metric("Moderation records", moderationCount.rows[0].count)}
        ${metric("Latest cycle", lastCycle ? lastCycle.label : "None")}
      </section>

      <section class="staff-management-grid">
        <a class="management-card" href="/staff-management/discipline">
          <span class="management-number">01</span>
          <div>
            <p class="eyebrow">ACCOUNTABILITY</p>
            <h2>Discipline</h2>
            <p>Issue counseling and formal actions, then route them through approval.</p>
          </div>
        </a>

        <a class="management-card" href="/staff-management/pay-cycles">
          <span class="management-number">02</span>
          <div>
            <p class="eyebrow">COMPENSATION</p>
            <h2>Pay cycles</h2>
            <p>Create cycles, build the server roster, calculate payouts, and notify staff.</p>
          </div>
        </a>

        <a class="management-card" href="/staff-management/moderation">
          <span class="management-number">03</span>
          <div>
            <p class="eyebrow">INTERNAL RECORDS</p>
            <h2>General moderation</h2>
            <p>View informational moderation records and their change history.</p>
          </div>
        </a>
      </section>
    `;

    res.send(layout("Staff Management", body, req.user, "staff-management"));
  });

  app.get("/staff-management/discipline", requireTeamLeadPlus, (req, res) => {
    res.redirect("/punishments");
  });

  app.get("/staff-management/pay-cycles", requireTeamLeadPlus, async (req, res) => {
    const cycles = await q(`
      SELECT
        c.*,
        u.display_name AS creator_name,
        COUNT(m.id) AS roster_count,
        COALESCE(SUM(CASE WHEN m.included AND NOT m.disqualified THEN m.regular_pay + m.bonus ELSE 0 END),0) AS payout_total
      FROM wed_pay_cycles c
      LEFT JOIN wed_users u ON u.discord_user_id=c.created_by
      LEFT JOIN wed_pay_cycle_members m ON m.cycle_id=c.id
      GROUP BY c.id,u.display_name
      ORDER BY c.created_at DESC
    `);

    const cards = cycles.rows.map(cycle => `
      <article class="pay-cycle-card">
        <div class="record-topline">
          <div>
            <span class="record-kicker">Cycle #${cycle.id}</span>
            <h2>${esc(cycle.label)}</h2>
          </div>
          ${badge(cycle.status)}
        </div>
        <div class="pay-cycle-summary">
          <span><strong>${esc(cycle.roster_count)}</strong> rostered</span>
          <span><strong>${esc(cycle.payout_total)}</strong> Robux allocated</span>
          <span><strong>${esc(cycle.total_budget ?? "—")}</strong> budget</span>
        </div>
        <div class="record-meta">
          <span>${esc(date(cycle.starts_at))} – ${esc(date(cycle.ends_at))}</span>
          <span>Created by ${esc(cycle.creator_name || cycle.created_by)}</span>
        </div>
        <div class="record-actions">
          <a class="button primary small" href="/staff-management/pay-cycles/${cycle.id}">Open cycle</a>
          ${adminDeleteButton(req.user, "pay_cycle", cycle.id)}
        </div>
      </article>
    `).join("");

    const body = `
      ${flash(req)}
      ${pageTitle(
        "Pay cycles",
        "STAFF MANAGEMENT",
        "Create, review, finalize, and audit staff compensation cycles.",
        `<a class="button primary" href="/staff-management/pay-cycles/new">Create pay cycle</a>`
      )}
      <section class="record-grid">
        ${cards || emptyState("No pay cycles", "Create the first cycle to generate a server roster.")}
      </section>
    `;

    res.send(layout("Pay Cycles", body, req.user, "staff-management"));
  });

  app.get("/staff-management/pay-cycles/new", requireTeamLeadPlus, (req, res) => {
    const body = `
      ${pageTitle(
        "Create pay cycle",
        "COMPENSATION",
        "Define the cycle and budget. The server roster will be generated automatically."
      )}
      <form class="panel form-grid" method="post" action="/staff-management/pay-cycles">
        ${formField("Cycle name", "label")}
        ${formField("Start date", "starts_at", "", "date", false)}
        ${formField("End date", "ends_at", "", "date", false)}
        ${formField("Total budget", "total_budget", "", "number", false)}
        ${formField("Developer pool", "developer_pool", "", "number", false)}
        ${formField("Leadership pool", "leadership_pool", "", "number", false)}
        ${formField("Bonus pool", "bonus_pool", "", "number", false)}
        ${textArea("Cycle notes", "notes", "", false)}
        <div class="form-actions">
          <button class="primary">Create cycle and roster</button>
          <a class="button ghost" href="/staff-management/pay-cycles">Cancel</a>
        </div>
      </form>
    `;

    res.send(layout("Create Pay Cycle", body, req.user, "staff-management"));
  });

  app.post("/staff-management/pay-cycles", requireTeamLeadPlus, async (req, res) => {
    await syncGuildMembers(client, true).catch(console.error);

    const cycle = (
      await q(
        `INSERT INTO wed_pay_cycles(
          label,starts_at,ends_at,total_budget,developer_pool,leadership_pool,
          bonus_pool,notes,status,created_by
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9)
        RETURNING *`,
        [
          req.body.label,
          req.body.starts_at || null,
          req.body.ends_at || null,
          req.body.total_budget || null,
          req.body.developer_pool || null,
          req.body.leadership_pool || null,
          req.body.bonus_pool || null,
          req.body.notes || null,
          req.user.discord_user_id
        ]
      )
    ).rows[0];

    await q(
      `
      INSERT INTO wed_pay_cycle_members(
        cycle_id,discord_user_id,discord_username,display_name,position,
        category,active_this_cycle,included,disqualified,disqualification_reason,
        pay_method,percentage,regular_pay,bonus,notes
      )
      SELECT
        $1,
        u.discord_user_id,
        u.discord_username,
        u.display_name,
        u.department_role,
        COALESCE(p.default_category,u.team,u.department_role),
        TRUE,
        TRUE,
        COALESCE(p.globally_disqualified,FALSE),
        p.disqualification_reason,
        CASE WHEN p.default_fixed_pay IS NOT NULL THEN 'fixed'
             WHEN p.default_percentage IS NOT NULL THEN 'percentage'
             ELSE 'fixed' END,
        p.default_percentage,
        COALESCE(p.default_fixed_pay,0),
        0,
        p.notes
      FROM wed_users u
      LEFT JOIN wed_pay_profiles p ON p.discord_user_id=u.discord_user_id
      WHERE u.active=TRUE
      ON CONFLICT(cycle_id,discord_user_id) DO NOTHING
      `,
      [cycle.id]
    );

    await logAdminAction(
      req,
      "pay_cycle_created",
      "pay_cycle",
      cycle.id,
      `Pay cycle "${cycle.label}" created and roster generated.`
    );

    notify(client, "Pay cycle created", `${cycle.label} was created by ${req.user.display_name}.`);
    res.redirect(`/staff-management/pay-cycles/${cycle.id}?ok=Pay%20cycle%20created`);
  });

  app.get("/staff-management/pay-cycles/:id", requireTeamLeadPlus, async (req, res) => {
    const cycle = (
      await q(`SELECT * FROM wed_pay_cycles WHERE id=$1`, [req.params.id])
    ).rows[0];
    if (!cycle) return res.sendStatus(404);

    const members = await q(
      `SELECT * FROM wed_pay_cycle_members WHERE cycle_id=$1
       ORDER BY included DESC,LOWER(display_name)`,
      [req.params.id]
    );

    const totals = members.rows.reduce((acc, member) => {
      if (member.included && !member.disqualified) {
        acc.regular += Number(member.regular_pay || 0);
        acc.bonus += Number(member.bonus || 0);
      }
      if (member.developer_of_month) acc.dotm += 1;
      if (member.disqualified) acc.disqualified += 1;
      return acc;
    }, { regular: 0, bonus: 0, dotm: 0, disqualified: 0 });

    const totalPayout = totals.regular + totals.bonus;
    const remaining = cycle.total_budget == null ? null : Number(cycle.total_budget) - totalPayout;
    const locked = cycle.status === "finalized";

    const memberRows = members.rows.map(member => `
      <tr>
        <td>
          <strong>${esc(member.display_name || member.discord_username)}</strong>
          <br><small>${esc(member.discord_user_id)}</small>
        </td>
        <td>${esc(pretty(member.position || "staff"))}</td>
        <td>${esc(member.category || "—")}</td>
        <td>${member.active_this_cycle ? badge("active") : badge("inactive")}</td>
        <td>${member.included ? badge("included") : badge("removed")}</td>
        <td>${member.disqualified ? badge("disqualified") : badge("eligible")}</td>
        <td>${esc(member.regular_pay || 0)}</td>
        <td>${esc(member.bonus || 0)}</td>
        <td>${member.developer_of_month ? badge("developer_of_month") : "—"}</td>
        <td>${esc(member.dm_status)}</td>
        <td>
          <a class="button ghost small" href="/staff-management/pay-cycles/${cycle.id}/members/${member.id}">Edit</a>
        </td>
      </tr>
    `).join("");

    const warnings = [];
    if (cycle.total_budget != null && totalPayout > Number(cycle.total_budget)) {
      warnings.push(`Payout exceeds the total budget by ${totalPayout - Number(cycle.total_budget)} Robux.`);
    }
    if (totals.dotm > 1) warnings.push("More than one person is marked Developer of the Month.");
    if (!members.rows.some(member => member.included && !member.disqualified && Number(member.regular_pay || 0) + Number(member.bonus || 0) > 0)) {
      warnings.push("No eligible staff member currently has a payout.");
    }

    const warningHtml = warnings.length
      ? `<section class="warning-panel"><strong>Cycle warnings</strong><ul>${warnings.map(w => `<li>${esc(w)}</li>`).join("")}</ul></section>`
      : `<section class="success-panel"><strong>No blocking warnings detected.</strong></section>`;

    const body = `
      ${flash(req)}
      ${pageTitle(
        cycle.label,
        `PAY CYCLE #${cycle.id}`,
        `${date(cycle.starts_at)} – ${date(cycle.ends_at)}`,
        `<a class="button ghost" href="/staff-management/pay-cycles">All cycles</a>`
      )}

      <section class="metrics-grid compact-metrics">
        ${metric("Regular pay", totals.regular)}
        ${metric("Bonuses", totals.bonus)}
        ${metric("Total payout", totalPayout)}
        ${metric("Remaining budget", remaining == null ? "Unspecified" : remaining)}
        ${metric("Disqualified", totals.disqualified)}
      </section>

      ${warningHtml}

      <section class="panel">
        <div class="section-heading">
          <div><p class="eyebrow">CYCLE CONTROLS</p><h2>Manage roster</h2></div>
        </div>
        <div class="record-actions">
          ${!locked ? `<form method="post" action="/staff-management/pay-cycles/${cycle.id}/refresh-roster"><button class="ghost">Refresh server roster</button></form>` : ""}
          ${!locked ? `<form method="post" action="/staff-management/pay-cycles/${cycle.id}/status"><input type="hidden" name="status" value="review"><button class="ghost">Move to review</button></form>` : ""}
          ${!locked ? `<form method="post" action="/staff-management/pay-cycles/${cycle.id}/finalize" onsubmit="return confirm('Finalize this cycle and DM all paid staff?');"><button class="primary">Finalize and notify staff</button></form>` : ""}
          ${locked && isAdministrator(req.user) ? `<form method="post" action="/staff-management/pay-cycles/${cycle.id}/unlock"><button class="danger">Administration override: unlock</button></form>` : ""}
        </div>
      </section>

      <div class="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Staff member</th>
              <th>Position</th>
              <th>Category</th>
              <th>Active</th>
              <th>Included</th>
              <th>Eligibility</th>
              <th>Pay</th>
              <th>Bonus</th>
              <th>DOTM</th>
              <th>DM</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>${memberRows}</tbody>
        </table>
      </div>
    `;

    res.send(layout(cycle.label, body, req.user, "staff-management"));
  });

  app.get("/staff-management/pay-cycles/:cycleId/members/:memberId", requireTeamLeadPlus, async (req, res) => {
    const member = (
      await q(
        `SELECT m.*,c.label,c.status AS cycle_status
         FROM wed_pay_cycle_members m
         JOIN wed_pay_cycles c ON c.id=m.cycle_id
         WHERE m.id=$1 AND m.cycle_id=$2`,
        [req.params.memberId, req.params.cycleId]
      )
    ).rows[0];
    if (!member) return res.sendStatus(404);

    const locked = member.cycle_status === "finalized";

    const body = `
      ${pageTitle(
        member.display_name || member.discord_username,
        member.label,
        "Edit this staff member's cycle-specific payout and eligibility."
      )}
      <form class="panel form-grid" method="post" action="/staff-management/pay-cycles/${req.params.cycleId}/members/${req.params.memberId}">
        ${formField("Position", "position", member.position || "", "text", false)}
        ${formField("Category", "category", member.category || "", "text", false)}
        ${formField("Roblox username", "roblox_username", member.roblox_username || "", "text", false)}
        ${formField("Roblox ID", "roblox_user_id", member.roblox_user_id || "", "text", false)}
        <label><span>Pay method</span><select name="pay_method"><option value="fixed" ${member.pay_method === "fixed" ? "selected" : ""}>Fixed</option><option value="percentage" ${member.pay_method === "percentage" ? "selected" : ""}>Percentage</option></select></label>
        ${formField("Percentage", "percentage", member.percentage ?? "", "number", false)}
        ${formField("Regular pay", "regular_pay", member.regular_pay || 0, "number")}
        ${formField("Bonus", "bonus", member.bonus || 0, "number")}
        <label class="check"><input type="checkbox" name="active_this_cycle" ${member.active_this_cycle ? "checked" : ""}><span>Active this cycle</span></label>
        <label class="check"><input type="checkbox" name="included" ${member.included ? "checked" : ""}><span>Include in cycle</span></label>
        <label class="check"><input type="checkbox" name="disqualified" ${member.disqualified ? "checked" : ""}><span>Disqualified</span></label>
        <label class="check"><input type="checkbox" name="developer_of_month" ${member.developer_of_month ? "checked" : ""}><span>Developer of the Month</span></label>
        ${textArea("Disqualification reason", "disqualification_reason", member.disqualification_reason || "", false)}
        ${textArea("Detailed notes", "notes", member.notes || "", false)}
        <label class="check field-span"><input type="checkbox" name="save_global_profile"><span>Save eligibility and defaults to this user's global pay profile</span></label>
        <div class="form-actions">
          <button class="primary" ${locked ? "disabled" : ""}>Save member</button>
          <a class="button ghost" href="/staff-management/pay-cycles/${req.params.cycleId}">Back to cycle</a>
        </div>
      </form>
    `;

    res.send(layout("Edit Pay Member", body, req.user, "staff-management"));
  });

  app.post("/staff-management/pay-cycles/:cycleId/members/:memberId", requireTeamLeadPlus, async (req, res) => {
    const cycle = (
      await q(`SELECT * FROM wed_pay_cycles WHERE id=$1`, [req.params.cycleId])
    ).rows[0];
    if (!cycle) return res.sendStatus(404);
    if (cycle.status === "finalized") return res.status(409).send("Finalized cycles are locked.");

    const updated = (
      await q(
        `UPDATE wed_pay_cycle_members SET
          position=$1,category=$2,roblox_username=$3,roblox_user_id=$4,
          pay_method=$5,percentage=$6,regular_pay=$7,bonus=$8,
          active_this_cycle=$9,included=$10,disqualified=$11,
          developer_of_month=$12,disqualification_reason=$13,notes=$14,
          updated_at=NOW()
         WHERE id=$15 AND cycle_id=$16
         RETURNING *`,
        [
          req.body.position || null,
          req.body.category || null,
          req.body.roblox_username || null,
          req.body.roblox_user_id || null,
          req.body.pay_method === "percentage" ? "percentage" : "fixed",
          req.body.percentage || null,
          Number(req.body.regular_pay || 0),
          Number(req.body.bonus || 0),
          Boolean(req.body.active_this_cycle),
          Boolean(req.body.included),
          Boolean(req.body.disqualified),
          Boolean(req.body.developer_of_month),
          req.body.disqualification_reason || null,
          req.body.notes || null,
          req.params.memberId,
          req.params.cycleId
        ]
      )
    ).rows[0];

    if (!updated) return res.sendStatus(404);

    if (req.body.save_global_profile) {
      await q(
        `INSERT INTO wed_pay_profiles(
          discord_user_id,globally_eligible,globally_disqualified,
          disqualification_reason,default_category,default_percentage,
          default_fixed_pay,default_bonus_eligible,notes,updated_by,updated_at
        ) VALUES($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$9,NOW())
        ON CONFLICT(discord_user_id) DO UPDATE SET
          globally_eligible=EXCLUDED.globally_eligible,
          globally_disqualified=EXCLUDED.globally_disqualified,
          disqualification_reason=EXCLUDED.disqualification_reason,
          default_category=EXCLUDED.default_category,
          default_percentage=EXCLUDED.default_percentage,
          default_fixed_pay=EXCLUDED.default_fixed_pay,
          notes=EXCLUDED.notes,
          updated_by=EXCLUDED.updated_by,
          updated_at=NOW()`,
        [
          updated.discord_user_id,
          !updated.disqualified,
          updated.disqualified,
          updated.disqualification_reason,
          updated.category,
          updated.percentage,
          updated.regular_pay,
          updated.notes,
          req.user.discord_user_id
        ]
      );
    }

    await logAdminAction(
      req,
      "pay_cycle_member_updated",
      "pay_cycle_member",
      updated.id,
      `${updated.display_name || updated.discord_username} was updated in cycle #${req.params.cycleId}.`
    );

    res.redirect(`/staff-management/pay-cycles/${req.params.cycleId}?ok=Pay%20member%20updated`);
  });

  app.post("/staff-management/pay-cycles/:id/refresh-roster", requireTeamLeadPlus, async (req, res) => {
    const cycle = (
      await q(`SELECT * FROM wed_pay_cycles WHERE id=$1`, [req.params.id])
    ).rows[0];
    if (!cycle) return res.sendStatus(404);
    if (cycle.status === "finalized") return res.status(409).send("Finalized cycles are locked.");

    await syncGuildMembers(client, true).catch(console.error);

    await q(
      `
      INSERT INTO wed_pay_cycle_members(
        cycle_id,discord_user_id,discord_username,display_name,position,
        category,active_this_cycle,included,disqualified,disqualification_reason,
        pay_method,percentage,regular_pay,bonus,notes
      )
      SELECT
        $1,u.discord_user_id,u.discord_username,u.display_name,u.department_role,
        COALESCE(p.default_category,u.team,u.department_role),TRUE,TRUE,
        COALESCE(p.globally_disqualified,FALSE),p.disqualification_reason,
        CASE WHEN p.default_fixed_pay IS NOT NULL THEN 'fixed'
             WHEN p.default_percentage IS NOT NULL THEN 'percentage'
             ELSE 'fixed' END,
        p.default_percentage,COALESCE(p.default_fixed_pay,0),0,p.notes
      FROM wed_users u
      LEFT JOIN wed_pay_profiles p ON p.discord_user_id=u.discord_user_id
      WHERE u.active=TRUE
      ON CONFLICT(cycle_id,discord_user_id) DO UPDATE SET
        discord_username=EXCLUDED.discord_username,
        display_name=EXCLUDED.display_name,
        position=EXCLUDED.position
      `,
      [req.params.id]
    );

    await logAdminAction(req, "pay_cycle_roster_refreshed", "pay_cycle", req.params.id, "Server roster refreshed.");
    res.redirect(`/staff-management/pay-cycles/${req.params.id}?ok=Roster%20refreshed`);
  });

  app.post("/staff-management/pay-cycles/:id/status", requireTeamLeadPlus, async (req, res) => {
    const allowed = new Set(["draft", "open", "review"]);
    const status = allowed.has(req.body.status) ? req.body.status : "review";

    await q(
      `UPDATE wed_pay_cycles SET status=$1,updated_at=NOW() WHERE id=$2 AND status<>'finalized'`,
      [status, req.params.id]
    );

    await logAdminAction(req, "pay_cycle_status_changed", "pay_cycle", req.params.id, `Pay cycle status changed to ${status}.`);
    res.redirect(`/staff-management/pay-cycles/${req.params.id}?ok=Cycle%20status%20updated`);
  });

  app.post("/staff-management/pay-cycles/:id/finalize", requireTeamLeadPlus, async (req, res) => {
    const cycle = (
      await q(`SELECT * FROM wed_pay_cycles WHERE id=$1`, [req.params.id])
    ).rows[0];
    if (!cycle) return res.sendStatus(404);
    if (cycle.status === "finalized") return res.status(409).send("Cycle is already finalized.");

    const members = (
      await q(
        `SELECT * FROM wed_pay_cycle_members
         WHERE cycle_id=$1 AND included=TRUE AND disqualified=FALSE
         ORDER BY LOWER(display_name)`,
        [req.params.id]
      )
    ).rows;

    const paidMembers = members.filter(member =>
      Number(member.regular_pay || 0) + Number(member.bonus || 0) > 0
    );

    const total = paidMembers.reduce(
      (sum, member) => sum + Number(member.regular_pay || 0) + Number(member.bonus || 0),
      0
    );

    if (cycle.total_budget != null && total > Number(cycle.total_budget)) {
      return res.status(400).send("The payout exceeds the cycle budget.");
    }

    const dotmCount = paidMembers.filter(member => member.developer_of_month).length;
    if (dotmCount > 1) {
      return res.status(400).send("Only one Developer of the Month may be selected.");
    }

    await q("BEGIN");

    try {
      await q(
        `UPDATE wed_pay_cycles SET
          status='finalized',finalized_by=$1,finalized_at=NOW(),updated_at=NOW()
         WHERE id=$2`,
        [req.user.discord_user_id, req.params.id]
      );

      for (const member of paidMembers) {
        try {
          const user = await client.users.fetch(member.discord_user_id);
          const totalPay = Number(member.regular_pay || 0) + Number(member.bonus || 0);

          const fields = [
            { name: "Regular pay", value: `${member.regular_pay || 0} Robux`, inline: true },
            { name: "Bonus", value: `${member.bonus || 0} Robux`, inline: true },
            { name: "Total", value: `${totalPay} Robux`, inline: true }
          ];

          if (member.developer_of_month) {
            fields.push({
              name: "Developer of the Month",
              value: "You were selected as Developer of the Month. Check your DMs with leadership for more information regarding its perks.",
              inline: false
            });
          }

          await user.send({
            embeds: [{
              title: `WED Pay Cycle Finalized: ${cycle.label}`,
              description: "Your payment information for this cycle is below.",
              color: 0x8b6cff,
              fields,
              footer: { text: "Wes Evil Development" },
              timestamp: new Date().toISOString()
            }]
          });

          await q(
            `UPDATE wed_pay_cycle_members
             SET dm_status='sent',dm_error=NULL,updated_at=NOW()
             WHERE id=$1`,
            [member.id]
          );
        } catch (error) {
          await q(
            `UPDATE wed_pay_cycle_members
             SET dm_status='failed',dm_error=$1,updated_at=NOW()
             WHERE id=$2`,
            [String(error?.message || error).slice(0, 1500), member.id]
          );
        }
      }

      await q("COMMIT");
    } catch (error) {
      await q("ROLLBACK");
      throw error;
    }

    try {
      const channel = await client.channels.fetch("1518936415809830922");
      await channel.send({
        embeds: [{
          title: "Pay cycle finalized",
          description: `The **${cycle.label}** pay cycle has been finalized. Staff receiving payment should check their DMs.`,
          color: 0x8b6cff,
          timestamp: new Date().toISOString()
        }]
      });
    } catch (error) {
      console.error("Could not send pay-cycle announcement:", error);
    }

    await logAdminAction(
      req,
      "pay_cycle_finalized",
      "pay_cycle",
      req.params.id,
      `${cycle.label} finalized with ${paidMembers.length} paid staff and ${total} Robux allocated.`,
      { paid_members: paidMembers.length, total }
    );

    res.redirect(`/staff-management/pay-cycles/${req.params.id}?ok=Pay%20cycle%20finalized`);
  });

  app.post("/staff-management/pay-cycles/:id/unlock", requireAdministrator, async (req, res) => {
    await q(
      `UPDATE wed_pay_cycles
       SET status='review',unlocked_by=$1,unlocked_at=NOW(),updated_at=NOW()
       WHERE id=$2`,
      [req.user.discord_user_id, req.params.id]
    );

    await logAdminAction(req, "pay_cycle_unlocked", "pay_cycle", req.params.id, "Finalized pay cycle unlocked by Administration.");
    res.redirect(`/staff-management/pay-cycles/${req.params.id}?ok=Cycle%20unlocked`);
  });

  app.get("/staff-management/moderation", requireTeamLeadPlus, async (req, res) => {
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").trim();

    const params = [];
    const conditions = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(
        discord_username ILIKE $${params.length}
        OR discord_user_id ILIKE $${params.length}
        OR roblox_username ILIKE $${params.length}
        OR roblox_user_id ILIKE $${params.length}
      )`);
    }

    if (status) {
      params.push(status);
      conditions.push(`status=$${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const records = await q(
      `SELECT * FROM wed_moderation_records
       ${where}
       ORDER BY updated_at DESC`,
      params
    );

    const cards = records.rows.map(record => `
      <article class="moderation-card">
        <div class="record-topline">
          <div>
            <span class="record-kicker">Record #${record.id}</span>
            <h2>${esc(record.discord_username || record.roblox_username || "Unnamed record")}</h2>
          </div>
          ${badge(record.status || "unclassified")}
        </div>
        <div class="moderation-flags">
          ${record.banned ? badge("banned") : ""}
          ${record.suspended ? badge("suspended") : ""}
          ${record.rank_locked ? badge("rank_locked") : ""}
          ${record.hard_strike ? badge("hard_strike") : ""}
          ${record.leadership ? badge("leadership") : ""}
        </div>
        <div class="record-meta">
          <span>${esc(record.position || "No position")}</span>
          <span>${esc(record.warnings)} warnings</span>
          <span>${esc(record.strikes)} strikes</span>
          <span>Updated ${esc(dateTime(record.updated_at))}</span>
        </div>
        <p>${esc(record.moderation_notes || "No moderation notes.")}</p>
        <div class="record-actions">
          <a class="button primary small" href="/staff-management/moderation/${record.id}">Open record</a>
          ${adminDeleteButton(req.user, "moderation_record", record.id)}
        </div>
      </article>
    `).join("");

    const body = `
      ${flash(req)}
      ${pageTitle(
        "General moderation",
        "INFORMATIONAL RECORDS",
        "Manually maintained moderation information. These records do not automatically enforce Discord or Roblox actions.",
        SECRETARY_PLUS_ROLES.has(req.user.department_role)
          ? `<a class="button primary" href="/staff-management/moderation/new">Create record</a>`
          : ""
      )}

      <form class="panel filter-bar" method="get" action="/staff-management/moderation">
        ${formField("Search username or ID", "search", search, "search", false)}
        ${formField("Status", "status", status, "text", false)}
        <div class="form-actions"><button class="primary">Filter</button><a class="button ghost" href="/staff-management/moderation">Clear</a></div>
      </form>

      <section class="record-grid">
        ${cards || emptyState("No moderation records", "Secretary+ may create the first informational record.")}
      </section>
    `;

    res.send(layout("General Moderation", body, req.user, "staff-management"));
  });

  app.get("/staff-management/moderation/new", requireSecretaryPlus, (req, res) => {
    const body = `
      ${pageTitle(
        "Create moderation record",
        "GENERAL MODERATION",
        "Enter the subject manually. This record is informational and does not perform enforcement."
      )}
      <form class="panel form-grid" method="post" action="/staff-management/moderation">
        ${formField("Discord username", "discord_username", "", "text", false)}
        ${formField("Discord ID", "discord_user_id", "", "text", false)}
        ${formField("Roblox username", "roblox_username", "", "text", false)}
        ${formField("Roblox ID", "roblox_user_id", "", "text", false)}
        ${formField("Position", "position", "", "text", false)}
        ${formField("Status", "status", "", "text", false)}
        ${formField("Warnings", "warnings", "0", "number")}
        ${formField("Strikes", "strikes", "0", "number")}
        ${formField("Write-up", "write_up", "", "text", false)}
        ${formField("Next appeal date", "next_appeal_at", "", "date", false)}
        <label class="check"><input type="checkbox" name="leadership"><span>Leadership</span></label>
        <label class="check"><input type="checkbox" name="banned"><span>Banned</span></label>
        <label class="check"><input type="checkbox" name="hard_strike"><span>Hard strike</span></label>
        <label class="check"><input type="checkbox" name="rank_locked"><span>Rank locked</span></label>
        <label class="check"><input type="checkbox" name="suspended"><span>Suspended</span></label>
        ${textArea("Moderation notes", "moderation_notes", "", false)}
        ${textArea("Internal notes", "internal_notes", "", false)}
        <div class="form-actions"><button class="primary">Create record</button></div>
      </form>
    `;

    res.send(layout("Create Moderation Record", body, req.user, "staff-management"));
  });

  app.post("/staff-management/moderation", requireSecretaryPlus, async (req, res) => {
    const record = (
      await q(
        `INSERT INTO wed_moderation_records(
          discord_username,discord_user_id,roblox_username,roblox_user_id,
          position,leadership,banned,warnings,strikes,hard_strike,write_up,
          rank_locked,suspended,status,next_appeal_at,moderation_notes,internal_notes,
          created_by,updated_by
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$18)
        RETURNING *`,
        [
          req.body.discord_username || null,
          req.body.discord_user_id || null,
          req.body.roblox_username || null,
          req.body.roblox_user_id || null,
          req.body.position || null,
          Boolean(req.body.leadership),
          Boolean(req.body.banned),
          Number(req.body.warnings || 0),
          Number(req.body.strikes || 0),
          Boolean(req.body.hard_strike),
          req.body.write_up || null,
          Boolean(req.body.rank_locked),
          Boolean(req.body.suspended),
          req.body.status || null,
          req.body.next_appeal_at || null,
          req.body.moderation_notes || null,
          req.body.internal_notes || null,
          req.user.discord_user_id
        ]
      )
    ).rows[0];

    await q(
      `INSERT INTO wed_moderation_history(record_id,changed_by,action,after_data)
       VALUES($1,$2,'created',$3)`,
      [record.id, req.user.discord_user_id, record]
    );

    await logAdminAction(req, "moderation_record_created", "moderation_record", record.id, "General moderation record created.");
    res.redirect(`/staff-management/moderation/${record.id}?ok=Moderation%20record%20created`);
  });

  app.get("/staff-management/moderation/:id", requireTeamLeadPlus, async (req, res) => {
    const record = (
      await q(`SELECT * FROM wed_moderation_records WHERE id=$1`, [req.params.id])
    ).rows[0];
    if (!record) return res.sendStatus(404);

    const history = await q(
      `SELECT h.*,u.display_name AS changed_by_name
       FROM wed_moderation_history h
       LEFT JOIN wed_users u ON u.discord_user_id=h.changed_by
       WHERE h.record_id=$1
       ORDER BY h.created_at DESC`,
      [req.params.id]
    );

    const historyItems = history.rows.map(item => `
      <article class="timeline-item">
        <div class="timeline-dot"></div>
        <div>
          <span>${esc(dateTime(item.created_at))}</span>
          <strong>${esc(pretty(item.action))}</strong>
          <p>${esc(item.changed_by_name || item.changed_by)}</p>
        </div>
      </article>
    `).join("");

    const canEdit = SECRETARY_PLUS_ROLES.has(req.user.department_role);

    const body = `
      ${flash(req)}
      ${pageTitle(
        record.discord_username || record.roblox_username || `Record #${record.id}`,
        "GENERAL MODERATION",
        "Informational record only. No automatic enforcement is performed."
      )}

      <section class="dashboard-grid">
        <article class="panel">
          <p class="eyebrow">SUBJECT</p>
          <h2>${esc(record.discord_username || "No Discord username")}</h2>
          <div class="moderation-detail-list">
            <div><span>Discord ID</span><strong>${esc(record.discord_user_id || "—")}</strong></div>
            <div><span>Roblox</span><strong>${esc(record.roblox_username || "—")}</strong></div>
            <div><span>Roblox ID</span><strong>${esc(record.roblox_user_id || "—")}</strong></div>
            <div><span>Position</span><strong>${esc(record.position || "—")}</strong></div>
            <div><span>Status</span><strong>${esc(record.status || "—")}</strong></div>
            <div><span>Next appeal</span><strong>${esc(date(record.next_appeal_at))}</strong></div>
          </div>
          <div class="moderation-flags">
            ${record.banned ? badge("banned") : ""}
            ${record.suspended ? badge("suspended") : ""}
            ${record.rank_locked ? badge("rank_locked") : ""}
            ${record.hard_strike ? badge("hard_strike") : ""}
            ${record.leadership ? badge("leadership") : ""}
          </div>
        </article>

        <article class="panel">
          <p class="eyebrow">COUNTS</p>
          <div class="metrics-grid compact-metrics">
            ${metric("Warnings", record.warnings)}
            ${metric("Strikes", record.strikes)}
          </div>
          <h3>Write-up</h3><p>${esc(record.write_up || "None recorded.")}</p>
          <h3>Moderation notes</h3><p>${esc(record.moderation_notes || "None recorded.")}</p>
          <h3>Internal notes</h3><p>${esc(record.internal_notes || "None recorded.")}</p>
        </article>
      </section>

      ${canEdit ? `
        <details class="panel" open>
          <summary>Edit record</summary>
          <form class="form-grid" method="post" action="/staff-management/moderation/${record.id}">
            ${formField("Discord username", "discord_username", record.discord_username || "", "text", false)}
            ${formField("Discord ID", "discord_user_id", record.discord_user_id || "", "text", false)}
            ${formField("Roblox username", "roblox_username", record.roblox_username || "", "text", false)}
            ${formField("Roblox ID", "roblox_user_id", record.roblox_user_id || "", "text", false)}
            ${formField("Position", "position", record.position || "", "text", false)}
            ${formField("Status", "status", record.status || "", "text", false)}
            ${formField("Warnings", "warnings", record.warnings || 0, "number")}
            ${formField("Strikes", "strikes", record.strikes || 0, "number")}
            ${formField("Write-up", "write_up", record.write_up || "", "text", false)}
            ${formField("Next appeal date", "next_appeal_at", record.next_appeal_at ? new Date(record.next_appeal_at).toISOString().slice(0,10) : "", "date", false)}
            <label class="check"><input type="checkbox" name="leadership" ${record.leadership ? "checked" : ""}><span>Leadership</span></label>
            <label class="check"><input type="checkbox" name="banned" ${record.banned ? "checked" : ""}><span>Banned</span></label>
            <label class="check"><input type="checkbox" name="hard_strike" ${record.hard_strike ? "checked" : ""}><span>Hard strike</span></label>
            <label class="check"><input type="checkbox" name="rank_locked" ${record.rank_locked ? "checked" : ""}><span>Rank locked</span></label>
            <label class="check"><input type="checkbox" name="suspended" ${record.suspended ? "checked" : ""}><span>Suspended</span></label>
            ${textArea("Moderation notes", "moderation_notes", record.moderation_notes || "", false)}
            ${textArea("Internal notes", "internal_notes", record.internal_notes || "", false)}
            <div class="form-actions">
              <button class="primary">Save changes</button>
              ${adminDeleteButton(req.user, "moderation_record", record.id)}
            </div>
          </form>
        </details>
      ` : ""}

      <section class="panel">
        <p class="eyebrow">CHANGE HISTORY</p>
        <h2>Record timeline</h2>
        <div class="timeline">${historyItems || `<p class="muted">No history entries.</p>`}</div>
      </section>
    `;

    res.send(layout("Moderation Record", body, req.user, "staff-management"));
  });

  app.post("/staff-management/moderation/:id", requireSecretaryPlus, async (req, res) => {
    const before = (
      await q(`SELECT * FROM wed_moderation_records WHERE id=$1`, [req.params.id])
    ).rows[0];
    if (!before) return res.sendStatus(404);

    const after = (
      await q(
        `UPDATE wed_moderation_records SET
          discord_username=$1,discord_user_id=$2,roblox_username=$3,roblox_user_id=$4,
          position=$5,leadership=$6,banned=$7,warnings=$8,strikes=$9,hard_strike=$10,
          write_up=$11,rank_locked=$12,suspended=$13,status=$14,next_appeal_at=$15,
          moderation_notes=$16,internal_notes=$17,updated_by=$18,updated_at=NOW()
         WHERE id=$19 RETURNING *`,
        [
          req.body.discord_username || null,
          req.body.discord_user_id || null,
          req.body.roblox_username || null,
          req.body.roblox_user_id || null,
          req.body.position || null,
          Boolean(req.body.leadership),
          Boolean(req.body.banned),
          Number(req.body.warnings || 0),
          Number(req.body.strikes || 0),
          Boolean(req.body.hard_strike),
          req.body.write_up || null,
          Boolean(req.body.rank_locked),
          Boolean(req.body.suspended),
          req.body.status || null,
          req.body.next_appeal_at || null,
          req.body.moderation_notes || null,
          req.body.internal_notes || null,
          req.user.discord_user_id,
          req.params.id
        ]
      )
    ).rows[0];

    await q(
      `INSERT INTO wed_moderation_history(
        record_id,changed_by,action,before_data,after_data
      ) VALUES($1,$2,'updated',$3,$4)`,
      [req.params.id, req.user.discord_user_id, before, after]
    );

    await logAdminAction(req, "moderation_record_updated", "moderation_record", req.params.id, "General moderation record updated.");
    res.redirect(`/staff-management/moderation/${req.params.id}?ok=Moderation%20record%20updated`);
  });

  app.get("/punishments", requireRole("team_lead"), async (req, res) => {
    await syncGuildMembers(client).catch(console.error);

    const punishments = await q(`
      SELECT
        p.*,
        s.display_name AS subject_name,
        s.avatar_url AS subject_avatar,
        i.display_name AS issuer_name,
        a.display_name AS approver_name
      FROM wed_punishments p
      JOIN wed_users s ON s.discord_user_id=p.subject_id
      JOIN wed_users i ON i.discord_user_id=p.issued_by
      LEFT JOIN wed_users a ON a.discord_user_id=p.approved_by
      ORDER BY p.issued_at DESC
    `);

    const users = (
      await q(`
        SELECT *
        FROM wed_users
        WHERE active=TRUE
        ORDER BY LOWER(display_name)
      `)
    ).rows;

    const options = users.map(user =>
      `<option value="${user.discord_user_id}">${esc(user.display_name || user.discord_username)}</option>`
    ).join("");

    const canApprove = APPROVER_ROLES.has(req.user.department_role);

    const cards = punishments.rows.map(item => `
      <article class="discipline-card">
        <div class="discipline-person">
          ${item.subject_avatar ? `<img src="${esc(item.subject_avatar)}" alt="">` : `<div class="avatar-fallback">${esc((item.subject_name || "W")[0])}</div>`}
          <div>
            <span>${esc(pretty(item.type))}</span>
            <h2>${esc(item.subject_name)}</h2>
          </div>
          ${badge(item.status)}
        </div>
        <p>${esc(item.reason)}</p>
        <div class="record-meta">
          <span>Issued by ${esc(item.issuer_name)}</span>
          <span>${esc(dateTime(item.issued_at))}</span>
          ${item.approver_name ? `<span>Approved by ${esc(item.approver_name)}</span>` : ""}
        </div>
        <div class="record-actions">
          ${item.evidence_url ? `<a class="button ghost small" href="${esc(item.evidence_url)}">Open evidence</a>` : ""}
          ${canApprove && item.status === "pending"
            ? `<form method="post" action="/punishments/${item.id}/approve"><button class="primary small">Approve</button></form>`
            : ""}
          ${canApprove && item.status === "pending"
            ? `<form method="post" action="/punishments/${item.id}/deny"><button class="danger small">Deny</button></form>`
            : ""}
          ${adminDeleteButton(req.user, "punishment", item.id)}
        </div>
      </article>
    `).join("");

    const body = `
      ${flash(req)}
      ${pageTitle("Discipline", "ACCOUNTABILITY", "Issue counseling and formal actions, then route them through approval.")}
      <section class="dashboard-grid">
        <form class="panel form-grid" method="post" action="/punishments">
          <div class="section-heading field-span"><div><p class="eyebrow">NEW ACTION</p><h2>Log disciplinary action</h2></div></div>
          <label>
            <span>Subject</span>
            <select name="subject_id" required>
              <option value="" selected disabled>Select a server member</option>
              ${options}
            </select>
          </label>
          <label>
            <span>Type</span>
            <select name="type" required>
              <option value="verbal_counseling">Verbal counseling</option>
              <option value="write_up">Write-up</option>
              <option value="suspension">Suspension</option>
              <option value="termination">Termination</option>
            </select>
          </label>
          ${textArea("Reason", "reason")}
          ${formField("Evidence URL", "evidence_url", "", "url", false)}
          <div class="form-actions"><button class="primary">Log action</button></div>
        </form>
        <div class="panel guidance-card">
          <p class="eyebrow">WORKFLOW</p>
          <h2>Approval rules</h2>
          <ol>
            <li>Team leadership records the action.</li>
            <li>Secretary or Director reviews pending actions.</li>
            <li>Approved actions become part of the official record.</li>
          </ol>
        </div>
      </section>
      <section class="section-block">
        <div class="section-heading"><div><p class="eyebrow">RECORDS</p><h2>Disciplinary history</h2></div></div>
        <section class="record-grid">${cards || emptyState("No disciplinary records", "Logged actions will appear here.")}</section>
      </section>
    `;

    res.send(layout("Discipline", body, req.user, "staff-management"));
  });

  app.post("/punishments", requireRole("team_lead"), async (req, res) => {
    const canApprove = APPROVER_ROLES.has(req.user.department_role);
    const status = canApprove ? "approved" : "pending";

    const result = await q(
      `
      INSERT INTO wed_punishments(
        subject_id,issued_by,approved_by,type,status,reason,evidence_url,approved_at
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id
      `,
      [
        req.body.subject_id,
        req.user.discord_user_id,
        canApprove ? req.user.discord_user_id : null,
        req.body.type,
        status,
        req.body.reason,
        req.body.evidence_url || null,
        canApprove ? new Date() : null
      ]
    );

    await audit(req.user.discord_user_id, "create", "punishment", result.rows[0].id, {
      type: req.body.type,
      status
    });

    notify(client, "Disciplinary action logged", `${req.body.type} — ${status}`);
    res.redirect("/punishments?ok=Disciplinary%20record%20saved");
  });

  app.post("/punishments/:id/approve", requireApprover, async (req, res) => {
    const result = await q(
      `
      UPDATE wed_punishments
      SET
        status='approved',
        approved_by=$1,
        approved_at=NOW()
      WHERE id=$2
        AND status='pending'
      RETURNING *
      `,
      [req.user.discord_user_id, req.params.id]
    );

    if (!result.rows[0]) {
      return res.status(404).send(
        layout(
          "Record not found",
          emptyState(
            "Pending action not found",
            "This disciplinary action may already have been reviewed.",
            `<a class="button primary" href="/punishments">Return to discipline</a>`
          ),
          req.user,
          "discipline"
        )
      );
    }

    await audit(req.user.discord_user_id, "approve", "punishment", req.params.id);
    notify(
      client,
      "Disciplinary action approved",
      `Punishment #${req.params.id} was approved.`
    );

    res.redirect("/punishments?ok=Disciplinary%20action%20approved");
  });

  app.post("/punishments/:id/deny", requireApprover, async (req, res) => {
    const result = await q(
      `
      UPDATE wed_punishments
      SET
        status='rejected',
        approved_by=$1,
        approved_at=NOW()
      WHERE id=$2
        AND status='pending'
      RETURNING *
      `,
      [req.user.discord_user_id, req.params.id]
    );

    if (!result.rows[0]) {
      return res.status(404).send(
        layout(
          "Record not found",
          emptyState(
            "Pending action not found",
            "This disciplinary action may already have been reviewed.",
            `<a class="button primary" href="/punishments">Return to discipline</a>`
          ),
          req.user,
          "discipline"
        )
      );
    }

    await audit(req.user.discord_user_id, "reject", "punishment", req.params.id);
    notify(
      client,
      "Disciplinary action rejected",
      `Punishment #${req.params.id} was rejected.`
    );

    res.redirect("/punishments?ok=Disciplinary%20action%20rejected");
  });

  app.get("/handbook", (req, res) => {
    const policies = handbook.map(([title, paragraph], index) => `
      <article class="policy-card">
        <span class="policy-number">${String(index + 1).padStart(2, "0")}</span>
        <div><h2>${esc(title)}</h2><p>${esc(paragraph)}</p></div>
      </article>
    `).join("");

    const body = `
      ${pageTitle("Department handbook", "WED HANDBOOK", "Operating standards, expectations, and department rules.")}
      <section class="policy-grid">${policies}</section>
    `;

    res.send(layout("Handbook", body, req.user, "handbook"));
  });

  app.get("/privacy", (req, res) => {
    const policies = [
      ["Who may use the portal", "Wes Evil Development provides services only to people who are at least 13 years old. The portal is not intended for children under 13, and users under 13 may not submit applications, create portal records, or use authenticated features."],
      ["Account and identity information", "We may collect Discord and Roblox identifiers, usernames, display names, avatars, server roles, department assignments, and authentication-related account information."],
      ["Operational records", "We may store applications, development logs, quality-control reviews, quota records, leave requests, Internal Affairs cases, published subject reports, appeals, disciplinary records, handbook acknowledgements, and related evidence or notes."],
      ["Security and administration logs", "For security, abuse prevention, troubleshooting, and accountability, we log sign-ins, failed sign-ins, IP addresses, browser and device user-agent information, requested pages, response status codes, timestamps, administrative actions, and deletion actions."],
      ["How information is used", "Information is used to authenticate users, operate WED, manage staffing and development work, review applications, conduct authorized investigations, publish subject-facing IA reports, process appeals, enforce policy, investigate misuse, and maintain audit trails."],
      ["Internal access", "Access is restricted by role and operational need. Authorized administrators may review security logs, login records, IP addresses, privacy requests, deletion actions, account access states, and other records required to operate and protect the portal."],
      ["Service providers", "Discord, Roblox, Railway, PostgreSQL, Vercel, and other configured infrastructure providers may process information as necessary to provide authentication, hosting, storage, networking, and related functionality."],
      ["Sharing", "WED does not sell or rent personal information. Information may be shared internally when required for operations, investigations, appeals, safety, security, disciplinary review, or policy enforcement."],
      ["Retention", "Records are retained according to operational need. Rejected or withdrawn applications are normally reviewed for deletion or anonymization after 180 days. IA records are normally reviewed after one year. Security, audit, login, deletion, discipline, appeal, and dispute records may be retained longer when reasonably necessary."],
      ["Security", "WED uses HTTPS, role-based access, Discord authentication, session controls, environment-based secrets, database permissions, request logging, and audit records. No online system can guarantee absolute security."],
      ["Your choices", "You may request access to, correction of, export of, or deletion of information associated with you. We may verify your Discord account before fulfilling a request. Some records may be retained when reasonably necessary for security, legal obligations, disputes, investigations, or abuse prevention."],
      ["Changes to this policy", "This policy may be updated when WED changes its features, security practices, data collection, administration tools, or service providers. The effective date will be revised when material changes are made."]
    ];

    const cards = policies.map(([title, paragraph], index) => `
      <article class="policy-card">
        <span class="policy-number">${String(index + 1).padStart(2, "0")}</span>
        <div><h2>${esc(title)}</h2><p>${esc(paragraph)}</p></div>
      </article>
    `).join("");

    const body = `
      ${pageTitle(
        "Privacy policy",
        "PRIVACY",
        "Effective July 28, 2026 · Services are intended for users age 13 and older."
      )}
      <section class="privacy-callout">
        <div>
          <p class="eyebrow">ADMINISTRATION LOGGING</p>
          <h2>This portal records security and access information.</h2>
          <p>That includes IP addresses, login attempts, browser information, visited routes, administrative actions, and deletion records. This is used to protect WED and maintain accountability.</p>
        </div>
      </section>
      <section class="policy-grid">${cards}</section>
      <section class="panel request-panel">
        <div>
          <p class="eyebrow">DATA REQUEST</p>
          <h2>Access, correction, export, or deletion</h2>
          <p>Your request is delivered to the WED administration panel. The Secretary is also notified in the configured log channel.</p>
        </div>
        <form class="form-grid" method="post" action="/privacy/request">
          ${formField("Discord username", "requester_username")}
          ${formField("Discord ID", "requester_discord_id", "", "text", false)}
          <label><span>Request type</span><select name="request_type"><option value="access">Access</option><option value="correction">Correction</option><option value="export">Export</option><option value="deletion">Deletion</option></select></label>
          ${textArea("Details", "details", "", false)}
          <label class="check field-span"><input type="checkbox" name="acknowledge" required><span>I understand that this request and related security information will be visible to authorized WED administrators.</span></label>
          <div class="form-actions"><button class="primary">Submit privacy request</button></div>
        </form>
      </section>
    `;

    res.send(layout("Privacy", body, req.user, "privacy"));
  });

  app.post("/privacy/request", async (req, res) => {
    if (!req.body.acknowledge) {
      return res.status(400).send("Acknowledgement is required.");
    }

    const result = await q(
      `
      INSERT INTO wed_data_requests(
        requester_discord_id,requester_username,request_type,details
      )
      VALUES($1,$2,$3,$4)
      RETURNING id
      `,
      [
        req.body.requester_discord_id || null,
        req.body.requester_username,
        req.body.request_type,
        req.body.details || null
      ]
    );

    const requestId = result.rows[0].id;
    const adminUrl = `${process.env.BASE_URL || "https://wed.ope674c.dev"}/administration?tab=privacy&request=${requestId}`;

    await audit(req.body.requester_discord_id || null, "submit", "data_request", requestId, {
      type: req.body.request_type
    });

    await q(
      `INSERT INTO wed_admin_actions(
        actor_id,action_type,target_type,target_id,summary,metadata,ip_address
      ) VALUES($1,'privacy_request_submitted','data_request',$2,$3,$4,$5)`,
      [
        req.body.requester_discord_id || null,
        String(requestId),
        `${req.body.requester_username} submitted a ${req.body.request_type} request.`,
        { request_type: req.body.request_type },
        getRequestIp(req)
      ]
    );

    const channelId = process.env.WED_LOG_CHANNEL_ID;
    if (channelId) {
      client.channels.fetch(channelId)
        .then(channel => channel.send({
          content: `<@1262179224660217948>`,
          allowedMentions: { users: ["1262179224660217948"] },
          embeds: [{
            title: `Privacy request #${requestId}`,
            description: `${req.body.requester_username} submitted a **${req.body.request_type}** request.`,
            color: 0x7c5cff,
            fields: [
              { name: "Discord ID", value: req.body.requester_discord_id || "Not provided", inline: true },
              { name: "IP logged", value: getRequestIp(req) || "Unavailable", inline: true }
            ],
            timestamp: new Date().toISOString()
          }],
          components: [{
            type: 1,
            components: [{
              type: 2,
              style: 5,
              label: "Open in Administration",
              url: adminUrl
            }]
          }]
        }))
        .catch(error => console.error("Privacy request notification failed:", error));
    }

    res.send(layout(
      "Request received",
      `
        <section class="success-screen">
          <span>REQUEST #${requestId}</span>
          <h1>Privacy request received.</h1>
          <p>Authorized administrators can now review it in the administration panel.</p>
          <a class="button primary" href="/">Return home</a>
        </section>
      `
    ));
  });

  app.get("/administration", requireAdministrator, async (req, res) => {
    const tab = String(req.query.tab || "overview");

    const [
      users,
      recentRequests,
      recentLogins,
      recentActions,
      privacyRequests,
      counts
    ] = await Promise.all([
      q(`SELECT * FROM wed_users ORDER BY updated_at DESC LIMIT 250`),
      q(`SELECT * FROM wed_admin_request_logs ORDER BY created_at DESC LIMIT 250`),
      q(`SELECT * FROM wed_admin_login_logs ORDER BY created_at DESC LIMIT 250`),
      q(`
        SELECT a.*,u.display_name AS actor_name
        FROM wed_admin_actions a
        LEFT JOIN wed_users u ON u.discord_user_id=a.actor_id
        ORDER BY a.created_at DESC
        LIMIT 250
      `),
      q(`SELECT * FROM wed_data_requests ORDER BY created_at DESC LIMIT 250`),
      q(`
        SELECT
          (SELECT COUNT(*) FROM wed_users) AS users,
          (SELECT COUNT(*) FROM wed_admin_login_logs WHERE created_at > NOW()-INTERVAL '24 hours') AS logins_24h,
          (SELECT COUNT(*) FROM wed_admin_login_logs WHERE success=FALSE AND created_at > NOW()-INTERVAL '24 hours') AS failed_24h,
          (SELECT COUNT(*) FROM wed_admin_request_logs WHERE created_at > NOW()-INTERVAL '24 hours') AS requests_24h,
          (SELECT COUNT(*) FROM wed_data_requests WHERE status='pending') AS privacy_pending,
          (SELECT COUNT(*) FROM wed_admin_actions WHERE created_at > NOW()-INTERVAL '24 hours') AS actions_24h
      `)
    ]);

    const c = counts.rows[0];

    const tabs = [
      ["overview", "Overview"],
      ["users", "Users"],
      ["logins", "Login Logs"],
      ["requests", "Request Logs"],
      ["actions", "Admin Actions"],
      ["privacy", "Privacy Requests"]
    ].map(([key, label]) =>
      `<a class="${tab === key ? "active" : ""}" href="/administration?tab=${key}">${label}</a>`
    ).join("");

    const userRows = users.rows.map(user => `
      <tr>
        <td><strong>${esc(user.display_name || user.discord_username)}</strong><br><small>${esc(user.discord_user_id)}</small></td>
        <td>${esc(pretty(user.department_role || "staff"))}</td>
        <td>${esc(user.team || "—")}</td>
        <td>${badge(user.access_state || "unknown")}</td>
        <td>${user.active ? badge("active") : badge("inactive")}</td>
        <td>${esc(dateTime(user.updated_at))}</td>
        <td>
          <form class="inline" method="post" action="/administration/users/${user.discord_user_id}/access">
            <select name="access_state">
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="hiatus">Hiatus</option>
              <option value="no_access">No access</option>
            </select>
            <button class="small">Update</button>
          </form>
        </td>
      </tr>
    `).join("");

    const loginRows = recentLogins.rows.map(row => `
      <tr>
        <td>${row.success ? badge("success") : badge("failed")}</td>
        <td>${esc(row.display_name || row.discord_username || "Unknown")}</td>
        <td><code>${esc(row.discord_user_id || "—")}</code></td>
        <td><code>${esc(row.ip_address || "—")}</code></td>
        <td>${esc(row.reason || "—")}</td>
        <td title="${esc(row.user_agent || "")}">${esc(String(row.user_agent || "Unknown").slice(0, 70))}</td>
        <td>${esc(dateTime(row.created_at))}</td>
        <td>${adminDeleteButton(req.user, "login_log", row.id)}</td>
      </tr>
    `).join("");

    const requestRows = recentRequests.rows.map(row => `
      <tr>
        <td>${esc(row.method)}</td>
        <td><code>${esc(row.path)}</code></td>
        <td>${esc(row.status_code)}</td>
        <td><code>${esc(row.ip_address || "—")}</code></td>
        <td><code>${esc(row.discord_user_id || "Guest")}</code></td>
        <td title="${esc(row.user_agent || "")}">${esc(String(row.user_agent || "Unknown").slice(0, 70))}</td>
        <td>${esc(dateTime(row.created_at))}</td>
        <td>${adminDeleteButton(req.user, "request_log", row.id)}</td>
      </tr>
    `).join("");

    const actionRows = recentActions.rows.map(row => `
      <tr>
        <td>${esc(pretty(row.action_type))}</td>
        <td>${esc(row.actor_name || row.actor_id || "System")}</td>
        <td>${esc(row.target_type || "—")}</td>
        <td><code>${esc(row.target_id || "—")}</code></td>
        <td>${esc(row.summary || "—")}</td>
        <td><code>${esc(row.ip_address || "—")}</code></td>
        <td>${esc(dateTime(row.created_at))}</td>
        <td>${adminDeleteButton(req.user, "admin_action", row.id)}</td>
      </tr>
    `).join("");

    const privacyCards = privacyRequests.rows.map(row => `
      <article class="admin-request-card ${String(req.query.request) === String(row.id) ? "highlight" : ""}">
        <div class="record-topline">
          <div><span class="record-kicker">Request #${row.id}</span><h2>${esc(row.requester_username)}</h2></div>
          ${badge(row.status)}
        </div>
        <div class="record-meta">
          <span>${esc(pretty(row.request_type))}</span>
          <span>Discord ID: ${esc(row.requester_discord_id || "Not provided")}</span>
          <span>${esc(dateTime(row.created_at))}</span>
        </div>
        <p>${esc(row.details || "No details supplied.")}</p>
        <form class="review-form" method="post" action="/administration/privacy/${row.id}">
          <label><span>Status</span><select name="status"><option value="pending">Pending</option><option value="in_review">In review</option><option value="completed">Completed</option><option value="denied">Denied</option></select></label>
          ${textArea("Administration notes", "admin_notes", row.admin_notes || "", false)}
          <div class="form-actions">
            <button class="primary">Update request</button>
            ${adminDeleteButton(req.user, "privacy_request", row.id)}
          </div>
        </form>
      </article>
    `).join("");

    const overview = `
      <section class="admin-overview-grid">
        ${metric("Total users", c.users)}
        ${metric("Logins, 24h", c.logins_24h)}
        ${metric("Failed logins, 24h", c.failed_24h)}
        ${metric("Requests, 24h", c.requests_24h)}
        ${metric("Privacy pending", c.privacy_pending)}
        ${metric("Admin actions, 24h", c.actions_24h)}
      </section>
      <section class="dashboard-grid">
        <article class="panel">
          <p class="eyebrow">SECURITY</p>
          <h2>Administration capabilities</h2>
          <ul class="admin-capability-list">
            <li>Review successful and failed Discord logins</li>
            <li>Inspect IP addresses and browser information</li>
            <li>Review visited routes and response codes</li>
            <li>Manage portal access states</li>
            <li>Process privacy and deletion requests</li>
            <li>Review administrative and deletion actions</li>
            <li>Delete selected portal records with an audit trail</li>
          </ul>
        </article>
        <article class="panel danger-zone">
          <p class="eyebrow">DANGER ZONE</p>
          <h2>Maintenance tools</h2>
          <p>These tools permanently remove records and preserve a deletion audit entry.</p>
          <form method="post" action="/administration/maintenance/purge-request-logs">
            <label><span>Delete request logs older than</span><select name="days"><option value="30">30 days</option><option value="90">90 days</option><option value="180">180 days</option><option value="365">1 year</option></select></label>
            <div class="form-actions"><button class="danger">Purge old request logs</button></div>
          </form>
        </article>
      </section>
    `;

    const panels = {
      overview,
      users: `<div class="tablewrap"><table><thead><tr><th>User</th><th>Role</th><th>Team</th><th>Access</th><th>Active</th><th>Updated</th><th>Action</th></tr></thead><tbody>${userRows}</tbody></table></div>`,
      logins: `<div class="tablewrap"><table><thead><tr><th>Result</th><th>User</th><th>Discord ID</th><th>IP</th><th>Reason</th><th>User Agent</th><th>Time</th><th>Delete</th></tr></thead><tbody>${loginRows}</tbody></table></div>`,
      requests: `<div class="tablewrap"><table><thead><tr><th>Method</th><th>Path</th><th>Status</th><th>IP</th><th>User</th><th>User Agent</th><th>Time</th><th>Delete</th></tr></thead><tbody>${requestRows}</tbody></table></div>`,
      actions: `<div class="tablewrap"><table><thead><tr><th>Action</th><th>Actor</th><th>Target</th><th>ID</th><th>Summary</th><th>IP</th><th>Time</th><th>Delete</th></tr></thead><tbody>${actionRows}</tbody></table></div>`,
      privacy: `<section class="record-grid">${privacyCards || emptyState("No privacy requests", "Submitted requests will appear here.")}</section>`
    };

    const body = `
      ${flash(req)}
      ${pageTitle(
        "Administration",
        "SECURITY AND OPERATIONS",
        "Login intelligence, IP records, privacy requests, account access, deletion auditing, and maintenance."
      )}
      <nav class="admin-tabs">${tabs}</nav>
      <section class="admin-panel-body">${panels[tab] || overview}</section>
    `;

    res.send(layout("Administration", body, req.user, "administration"));
  });

  app.post("/administration/users/:id/access", requireAdministrator, async (req, res) => {
    const allowed = new Set(["active", "suspended", "hiatus", "no_access"]);
    const accessState = allowed.has(req.body.access_state) ? req.body.access_state : "no_access";
    const active = accessState === "active";

    await q(
      `UPDATE wed_users SET access_state=$1,active=$2,updated_at=NOW() WHERE discord_user_id=$3`,
      [accessState, active, req.params.id]
    );

    await logAdminAction(
      req,
      "user_access_updated",
      "wed_user",
      req.params.id,
      `Access state changed to ${accessState}.`,
      { access_state: accessState }
    );

    res.redirect("/administration?tab=users&ok=User%20access%20updated");
  });

  app.post("/administration/privacy/:id", requireAdministrator, async (req, res) => {
    await q(
      `UPDATE wed_data_requests
       SET status=$1,admin_notes=$2,processed_by=$3,processed_at=CASE WHEN $1 IN ('completed','denied') THEN NOW() ELSE processed_at END
       WHERE id=$4`,
      [req.body.status, req.body.admin_notes || null, req.user.discord_user_id, req.params.id]
    );

    await logAdminAction(
      req,
      "privacy_request_updated",
      "data_request",
      req.params.id,
      `Privacy request marked ${req.body.status}.`,
      { status: req.body.status }
    );

    res.redirect(`/administration?tab=privacy&request=${req.params.id}&ok=Privacy%20request%20updated`);
  });

  app.post("/administration/maintenance/purge-request-logs", requireAdministrator, async (req, res) => {
    const allowedDays = new Set([30, 90, 180, 365]);
    const days = Number(req.body.days);
    if (!allowedDays.has(days)) return res.status(400).send("Invalid retention period.");

    const result = await q(
      `DELETE FROM wed_admin_request_logs
       WHERE created_at < NOW() - ($1::text || ' days')::interval
       RETURNING id`,
      [days]
    );

    await logAdminAction(
      req,
      "request_logs_deleted",
      "wed_admin_request_logs",
      null,
      `${result.rowCount} request log records older than ${days} days were deleted.`,
      { deleted_count: result.rowCount, older_than_days: days }
    );

    res.redirect(`/administration?ok=${result.rowCount}%20request%20logs%20deleted`);
  });

  app.post("/administration/delete/:type/:id", requireAdministrator, async (req, res) => {
    const type = req.params.type;
    const id = req.params.id;

    let deletedRecord = null;

    await q("BEGIN");

    try {
      if (type === "ia_case") {
        const result = await q(
          `DELETE FROM wed_background_checks WHERE id=$1 RETURNING *`,
          [id]
        );
        deletedRecord = result.rows[0];
      } else if (type === "development_log") {
        await q(`DELETE FROM wed_qc_handoffs WHERE development_log_id=$1`, [id]);
        const result = await q(
          `DELETE FROM wed_development_logs WHERE id=$1 RETURNING *`,
          [id]
        );
        deletedRecord = result.rows[0];
      } else if (type === "qc_handoff") {
        const result = await q(
          `DELETE FROM wed_qc_handoffs WHERE id=$1 RETURNING *`,
          [id]
        );
        deletedRecord = result.rows[0];
      } else if (type === "quota_period") {
        await q(`DELETE FROM wed_quota_entries WHERE period_id=$1`, [id]);
        const result = await q(
          `DELETE FROM wed_quota_periods WHERE id=$1 RETURNING *`,
          [id]
        );
        deletedRecord = result.rows[0];
      } else if (type === "leave_request") {
        const result = await q(
          `DELETE FROM wed_leave_requests WHERE id=$1 RETURNING *`,
          [id]
        );
        deletedRecord = result.rows[0];
      } else if (type === "application") {
        const result = await q(
          `DELETE FROM wed_applications WHERE id=$1 RETURNING *`,
          [id]
        );
        deletedRecord = result.rows[0];
      } else if (type === "punishment") {
        const result = await q(
          `DELETE FROM wed_punishments WHERE id=$1 RETURNING *`,
          [id]
        );
        deletedRecord = result.rows[0];
      } else if (type === "ia_note") {
        const result = await q(
          `DELETE FROM wed_ia_notes WHERE id=$1 RETURNING *`,
          [id]
        );
        deletedRecord = result.rows[0];
      } else if (type === "ia_evidence") {
        const result = await q(
          `DELETE FROM wed_ia_evidence WHERE id=$1 RETURNING *`,
          [id]
        );
        deletedRecord = result.rows[0];
      } else if (type === "ia_appeal") {
        const result = await q(
          `DELETE FROM wed_ia_appeals WHERE id=$1 RETURNING *`,
          [id]
        );
        deletedRecord = result.rows[0];
      } else if (type === "privacy_request") {
        const result = await q(
          `DELETE FROM wed_data_requests WHERE id=$1 RETURNING *`,
          [id]
        );
        deletedRecord = result.rows[0];
      } else if (type === "pay_cycle") {
        const result = await q(
          `DELETE FROM wed_pay_cycles WHERE id=$1 RETURNING *`,
          [id]
        );
        deletedRecord = result.rows[0];
      } else if (type === "moderation_record") {
        const result = await q(
          `DELETE FROM wed_moderation_records WHERE id=$1 RETURNING *`,
          [id]
        );
        deletedRecord = result.rows[0];
      } else if (type === "admin_action") {
        const result = await q(
          `DELETE FROM wed_admin_actions WHERE id=$1 RETURNING *`,
          [id]
        );
        deletedRecord = result.rows[0];
      } else if (type === "request_log") {
        const result = await q(
          `DELETE FROM wed_admin_request_logs WHERE id=$1 RETURNING *`,
          [id]
        );
        deletedRecord = result.rows[0];
      } else if (type === "login_log") {
        const result = await q(
          `DELETE FROM wed_admin_login_logs WHERE id=$1 RETURNING *`,
          [id]
        );
        deletedRecord = result.rows[0];
      } else {
        await q("ROLLBACK");
        return res.status(400).send("Unsupported deletion target.");
      }

      if (!deletedRecord) {
        await q("ROLLBACK");
        return res.status(404).send("Record not found.");
      }

      await q("COMMIT");
    } catch (error) {
      await q("ROLLBACK");
      console.error(`Failed to delete ${type} ${id}:`, error);
      return res.status(500).send(
        layout(
          "Deletion failed",
          emptyState(
            "Could not delete this record",
            "The record may still be referenced by another database entry. Check Railway logs for the exact constraint.",
            `<a class="button primary" href="${esc(req.headers.referer || "/administration")}">Return</a>`
          ),
          req.user,
          "administration"
        )
      );
    }

    await logAdminAction(
      req,
      "record_deleted",
      type,
      id,
      `${pretty(type)} record deleted.`,
      { deleted_record: deletedRecord }
    );

    res.redirect(req.headers.referer || "/administration?tab=actions");
  });

  app.get("/api/health", (req, res) => {
    res.json({
      ok: true,
      service: "wed-portal",
      time: new Date().toISOString()
    });
  });

  app.use((req, res) => {
  res.status(404).send(
    layout(
      "Page Not Found",
      `
      <section class="error-screen error-404">
        <div class="error-code">404</div>

        <div class="error-content">
          <p class="eyebrow">NAVIGATION ERROR</p>

          <h1>This page is not available.</h1>

          <p>
            The page you're looking for doesn't exist, was moved,
            or the link is outdated.
          </p>

          <div class="error-card">
            <span>Requested Path</span>
            <code>${esc(req.originalUrl)}</code>
          </div>

          <div class="actions">
            <a class="button primary" href="${req.user ? "/dashboard" : "/"}">
              Dashboard
            </a>

            <a class="button ghost" href="javascript:history.back()">
              Go Back
            </a>
          </div>
        </div>
      </section>
      `,
      req.user
    )
  );
});

  ensureIaSchema()
    .then(() => syncGuildMembers(client))
    .catch(error => {
      console.error("Initial WED setup failed:", error);
    });

  processDueLeaves().catch(console.error);
  setInterval(() => processDueLeaves().catch(console.error), 60 * 1000).unref();

  const port = process.env.PORT || 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`WED website running on port ${port}`);
  });
}

module.exports = { startWedServer };
