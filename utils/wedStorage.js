const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initWedDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wed_users (
      discord_user_id TEXT PRIMARY KEY,
      discord_username TEXT NOT NULL,
      display_name TEXT,
      avatar_url TEXT,
      department_role TEXT NOT NULL DEFAULT 'staff',
      team TEXT,
      discord_role_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      access_state TEXT NOT NULL DEFAULT 'active' CHECK (access_state IN ('active','suspended','hiatus','no_access')),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      privacy_acknowledged_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      timezone TEXT,
      timezone_confirmed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS wed_sessions (
      token_hash TEXT PRIMARY KEY,
      discord_user_id TEXT NOT NULL REFERENCES wed_users(discord_user_id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip_hash TEXT,
      user_agent TEXT
    );

    CREATE TABLE IF NOT EXISTS wed_oauth_states (
      state TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      return_to TEXT
    );

    CREATE TABLE IF NOT EXISTS wed_quota_periods (
      id BIGSERIAL PRIMARY KEY,
      label TEXT NOT NULL,
      starts_at TIMESTAMPTZ NOT NULL,
      ends_at TIMESTAMPTZ NOT NULL,
      target_points INTEGER NOT NULL DEFAULT 1 CHECK (target_points >= 0),
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('draft','open','closed')),
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS wed_quota_entries (
      id BIGSERIAL PRIMARY KEY,
      period_id BIGINT NOT NULL REFERENCES wed_quota_periods(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES wed_users(discord_user_id) ON DELETE CASCADE,
      points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','met','excused','failed')),
      leadership_note TEXT,
      updated_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(period_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS wed_development_logs (
      id BIGSERIAL PRIMARY KEY,
      author_id TEXT NOT NULL REFERENCES wed_users(discord_user_id),
      project TEXT NOT NULL,
      summary TEXT NOT NULL,
      details TEXT,
      work_type TEXT NOT NULL DEFAULT 'development',
      hours NUMERIC(6,2),
      evidence_url TEXT,
      trello_card_id TEXT,
      trello_card_url TEXT,
      qc_status TEXT NOT NULL DEFAULT 'not_submitted' CHECK (qc_status IN ('not_submitted','submitted','in_review','changes_requested','approved','rejected')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS wed_qc_handoffs (
      id BIGSERIAL PRIMARY KEY,
      development_log_id BIGINT NOT NULL REFERENCES wed_development_logs(id) ON DELETE CASCADE,
      submitted_by TEXT NOT NULL REFERENCES wed_users(discord_user_id),
      assigned_to TEXT REFERENCES wed_users(discord_user_id),
      testing_notes TEXT,
      result TEXT NOT NULL DEFAULT 'pending' CHECK (result IN ('pending','approved','changes_requested','rejected')),
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS wed_change_logs (
      id BIGSERIAL PRIMARY KEY,
      author_id TEXT NOT NULL REFERENCES wed_users(discord_user_id),
      area TEXT NOT NULL,
      change_summary TEXT NOT NULL,
      reference_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS wed_punishments (
      id BIGSERIAL PRIMARY KEY,
      subject_id TEXT NOT NULL REFERENCES wed_users(discord_user_id),
      issued_by TEXT NOT NULL REFERENCES wed_users(discord_user_id),
      approved_by TEXT REFERENCES wed_users(discord_user_id),
      type TEXT NOT NULL CHECK (type IN ('verbal_counseling','write_up','suspension','termination','other')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','active','expired','overturned')),
      reason TEXT NOT NULL,
      evidence_url TEXT,
      issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      approved_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      private_notes TEXT
    );

    CREATE TABLE IF NOT EXISTS wed_background_checks (
      id BIGSERIAL PRIMARY KEY,
      subject_username TEXT NOT NULL,
      subject_discord_id TEXT,
      subject_roblox_id TEXT,
      subject_wei_rank TEXT,
      requestee_username TEXT NOT NULL,
      requestee_roblox_id TEXT,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'awaiting_review' CHECK (status IN ('draft','awaiting_review','approved','denied','blocked','cancelled')),
      outcome_summary TEXT,
      friends_of_interest TEXT,
      groups_of_interest TEXT,
      discord_activity_review TEXT,
      discord_profile_review TEXT,
      major_infractions TEXT,
      minor_infractions TEXT,
      evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
      investigator_id TEXT NOT NULL REFERENCES wed_users(discord_user_id),
      certified_at TIMESTAMPTZ,
      retention_until TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS wed_applications (
      id BIGSERIAL PRIMARY KEY,
      discord_user_id TEXT,
      discord_username TEXT NOT NULL,
      roblox_username TEXT,
      roblox_user_id TEXT,
      position TEXT NOT NULL,
      answers JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft','submitted','screening','background_check','interview','accepted','denied','withdrawn')),
      reviewer_id TEXT REFERENCES wed_users(discord_user_id),
      reviewer_notes TEXT,
      privacy_consent_at TIMESTAMPTZ NOT NULL,
      retention_until TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS wed_audit_log (
      id BIGSERIAL PRIMARY KEY,
      actor_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );



    CREATE TABLE IF NOT EXISTS wed_leave_requests (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES wed_users(discord_user_id) ON DELETE CASCADE,
      leave_type TEXT NOT NULL DEFAULT 'loa' CHECK (leave_type IN ('loa','hiatus')),
      starts_at DATE NOT NULL,
      expected_return_at DATE NOT NULL,
      starts_at_utc TIMESTAMPTZ,
      expected_return_at_utc TIMESTAMPTZ,
      requester_timezone TEXT,
      reason TEXT NOT NULL,
      contact_notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied','cancelled','active','returned')),
      requires_hiatus BOOLEAN NOT NULL DEFAULT FALSE,
      leadership_stepdown_recommended BOOLEAN NOT NULL DEFAULT FALSE,
      temporary_replacement_id TEXT REFERENCES wed_users(discord_user_id),
      reviewer_id TEXT REFERENCES wed_users(discord_user_id),
      reviewer_notes TEXT,
      previous_role_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ,
      activated_at TIMESTAMPTZ,
      returned_at TIMESTAMPTZ,
      CHECK (expected_return_at >= starts_at)
    );

    CREATE TABLE IF NOT EXISTS wed_data_requests (
      id BIGSERIAL PRIMARY KEY,
      requester_discord_id TEXT,
      requester_username TEXT NOT NULL,
      request_type TEXT NOT NULL CHECK (request_type IN ('access','correction','deletion','export')),
      details TEXT,
      status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','in_review','completed','denied')),
      handled_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS wed_dev_logs_author_idx ON wed_development_logs(author_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS wed_punishments_subject_idx ON wed_punishments(subject_id, issued_at DESC);
    CREATE INDEX IF NOT EXISTS wed_bgc_status_idx ON wed_background_checks(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS wed_applications_status_idx ON wed_applications(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS wed_leave_user_idx ON wed_leave_requests(user_id, requested_at DESC);
    CREATE INDEX IF NOT EXISTS wed_leave_status_idx ON wed_leave_requests(status, starts_at);
  `);
  await pool.query(`ALTER TABLE wed_users ADD COLUMN IF NOT EXISTS discord_role_ids JSONB NOT NULL DEFAULT '[]'::jsonb`);
  await pool.query(`ALTER TABLE wed_users ADD COLUMN IF NOT EXISTS access_state TEXT NOT NULL DEFAULT 'active'`);
  await pool.query(`ALTER TABLE wed_users ADD COLUMN IF NOT EXISTS timezone TEXT`);
  await pool.query(`ALTER TABLE wed_users ADD COLUMN IF NOT EXISTS timezone_confirmed_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE wed_leave_requests ADD COLUMN IF NOT EXISTS starts_at_utc TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE wed_leave_requests ADD COLUMN IF NOT EXISTS expected_return_at_utc TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE wed_leave_requests ADD COLUMN IF NOT EXISTS requester_timezone TEXT`);
}


async function q(text, params = []) { return pool.query(text, params); }
async function audit(actorId, action, entityType, entityId, metadata = {}) {
  await q('INSERT INTO wed_audit_log(actor_id, action, entity_type, entity_id, metadata) VALUES($1,$2,$3,$4,$5)',
    [actorId || null, action, entityType, entityId ? String(entityId) : null, metadata]);
}

module.exports = { pool, q, audit, initWedDatabase };
