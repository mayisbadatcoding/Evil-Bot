const crypto = require('crypto');
const { q, audit } = require('./wedStorage');

const ROLE_ORDER = { applicant:0, contractor:8, staff:10, trial_qc:18, qc:20, trial_developer:18, developer:20, team_lead:40, secretary:60, director:80, executive:100, bot_developer:1000 };
function hash(value){ return crypto.createHash('sha256').update(value).digest('hex'); }
function parseCookies(req){ return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(v=>{const i=v.indexOf('=');return [decodeURIComponent(v.slice(0,i).trim()),decodeURIComponent(v.slice(i+1).trim())]})); }
function secureCookie(){ return process.env.NODE_ENV === 'production' ? '; Secure' : ''; }
async function createSession(res, user, req){
  const raw = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now()+1000*60*60*12);
  await q(`INSERT INTO wed_sessions(token_hash,discord_user_id,expires_at,ip_hash,user_agent) VALUES($1,$2,$3,$4,$5)`,
    [hash(raw), user.discord_user_id, expires, hash(req.ip || ''), String(req.headers['user-agent']||'').slice(0,500)]);
  res.setHeader('Set-Cookie', `wed_session=${raw}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${secureCookie()}`);
}
async function sessionMiddleware(req,res,next){
  const raw=parseCookies(req).wed_session;
  req.user=null;
  if(!raw) return next();
  const result=await q(`SELECT u.* FROM wed_sessions s JOIN wed_users u ON u.discord_user_id=s.discord_user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()`,[hash(raw)]);
  req.user=result.rows[0]||null;
  if(req.user) await q('UPDATE wed_sessions SET last_seen_at=NOW() WHERE token_hash=$1',[hash(raw)]);
  next();
}
function requireLogin(req,res,next){ if(!req.user) return res.redirect('/login'); if(req.user.access_state==='hiatus'||req.user.access_state==='no_access') return res.status(403).send('Your WED portal access is disabled while you are on hiatus. Contact Development Leadership to return.'); next(); }
function requireRole(minRole){ return (req,res,next)=>{ if(!req.user || (ROLE_ORDER[req.user.department_role]||0)<(ROLE_ORDER[minRole]||0)) return res.status(403).send('Access denied.'); next(); }; }
async function logout(req,res){ const raw=parseCookies(req).wed_session; if(raw) await q('DELETE FROM wed_sessions WHERE token_hash=$1',[hash(raw)]); res.setHeader('Set-Cookie',`wed_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureCookie()}`); }
module.exports={ROLE_ORDER,sessionMiddleware,requireLogin,requireRole,createSession,logout,hash};
