// Actualiza stats.json con los datos de Instagram de Nicolás.
// Lo ejecuta GitHub Actions cada día (ver .github/workflows/actualizar-instagram.yml).
// Versión con todos los archivos en la raíz del repositorio.
//
// Variables de entorno:
//   IG_TOKEN           token de larga duración de Instagram (API con inicio de sesión de Instagram)
//   GH_PAT             token de GitHub con permiso para escribir secretos del repo (renueva IG_TOKEN)
//   GITHUB_REPOSITORY  lo pone GitHub Actions solo ("usuario/repo")
//   IG_API_BASE        opcional, solo para pruebas

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = ROOT;
const STATS = join(DATA_DIR, "stats.json");
const HISTORY = join(DATA_DIR, "history.json");

const API = process.env.IG_API_BASE || "https://graph.instagram.com/v25.0";
const TOKEN_HOST = process.env.IG_API_BASE ? process.env.IG_API_BASE.replace(/\/v[\d.]+$/, "") : "https://graph.instagram.com";
const TOKEN = process.env.IG_TOKEN;
const POSTS_FOR_RATE = 12;

if (!TOKEN) {
  console.error("Falta IG_TOKEN. Añádelo como secreto del repositorio (Settings → Secrets and variables → Actions).");
  process.exit(1);
}

async function ig(path, params = {}) {
  const url = new URL(path.startsWith("http") ? path : `${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", TOKEN);
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const msg = body.error ? `${body.error.message} (código ${body.error.code})` : `HTTP ${res.status}`;
    throw new Error(`${path}: ${msg}`);
  }
  return body;
}

// Si un bloque falla, se registra el error y se conserva el dato anterior.
async function safe(label, fn, fallback) {
  try { return await fn(); }
  catch (err) { console.warn(`⚠ ${label}: ${err.message}`); return fallback; }
}

const round1 = n => Math.round(n * 10) / 10;
const today = () => new Date().toISOString().slice(0, 10);
const readJson = async (file, fallback) => { try { return JSON.parse(await readFile(file, "utf8")); } catch { return fallback; } };

/* ---------- 1. perfil ---------- */
async function getProfile() {
  const me = await ig("me", { fields: "user_id,username,followers_count,follows_count,media_count" });
  return { id: me.user_id || me.id, username: me.username, followers: me.followers_count, media: me.media_count };
}

/* ---------- 2. alcance e interacciones de los últimos 30 días ---------- */
async function get30Days(id) {
  const until = Math.floor(Date.now() / 1000);
  const since = until - 30 * 24 * 3600;
  const r = await ig(`${id}/insights`, {
    metric: "reach,total_interactions,accounts_engaged",
    period: "day", metric_type: "total_value", since, until,
  });
  const val = name => r.data?.find(m => m.name === name)?.total_value?.value ?? null;
  return { reach30: val("reach"), interactions30: val("total_interactions"), engaged30: val("accounts_engaged") };
}

/* ---------- 3. engagement rate de las últimas publicaciones ---------- */
async function getEngagement(id, followers) {
  const media = await ig(`${id}/media`, {
    fields: "id,timestamp,like_count,comments_count,media_product_type",
    limit: POSTS_FOR_RATE + 6,
  });
  const posts = (media.data || []).filter(m => m.media_product_type !== "STORY").slice(0, POSTS_FOR_RATE);
  if (!posts.length || !followers) return null;
  const counts = [];
  for (const p of posts) {
    const total = await safe(`interacciones de ${p.id}`, async () => {
      const r = await ig(`${p.id}/insights`, { metric: "total_interactions" });
      return r.data?.[0]?.values?.[0]?.value ?? r.data?.[0]?.total_value?.value ?? null;
    }, null);
    counts.push(total ?? ((p.like_count || 0) + (p.comments_count || 0)));
  }
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
  return {
    rate: round1(avg / followers * 100),
    posts: counts.length,
    lastPost: { interactions: counts[0], rate: round1(counts[0] / followers * 100), date: posts[0].timestamp },
  };
}

/* ---------- 4. demografía de seguidores ---------- */
async function getBreakdown(id, breakdown) {
  const r = await ig(`${id}/insights`, {
    metric: "follower_demographics", period: "lifetime", metric_type: "total_value",
    timeframe: "this_month", breakdown,
  });
  const results = r.data?.[0]?.total_value?.breakdowns?.[0]?.results || [];
  const map = new Map();
  for (const x of results) {
    const key = x.dimension_values[x.dimension_values.length - 1];
    map.set(key, (map.get(key) || 0) + x.value);
  }
  return map;
}

async function getDemographics(id) {
  const out = {};
  const gender = await safe("demografía por género", () => getBreakdown(id, "gender"), null);
  if (gender && gender.size) {
    const f = gender.get("F") || 0, m = gender.get("M") || 0;
    if (f + m > 0) out.gender = { male: round1(m / (f + m) * 100), female: round1(f / (f + m) * 100) };
  }
  const age = await safe("demografía por edad", () => getBreakdown(id, "age"), null);
  if (age && age.size) {
    const total = [...age.values()].reduce((a, b) => a + b, 0);
    const order = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
    const merged = new Map();
    for (const [k, v] of age) {
      const key = k === "55-64" || k === "65+" ? "55+" : k;
      merged.set(key, (merged.get(key) || 0) + v);
    }
    out.age = [...merged.entries()]
      .sort((a, b) => order.indexOf(a[0] === "55+" ? "55-64" : a[0]) - order.indexOf(b[0] === "55+" ? "55-64" : b[0]))
      .map(([k, v]) => [k, round1(v / total * 100)]);
  }
  const country = await safe("demografía por país", () => getBreakdown(id, "country"), null);
  if (country && country.size) {
    const total = [...country.values()].reduce((a, b) => a + b, 0);
    out.countries = [...country.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => [k, round1(v / total * 100)]);
  }
  return Object.keys(out).length ? out : null;
}

/* ---------- 5. histórico y crecimiento ---------- */
function growthFrom(history) {
  if (history.length < 2) return null;
  const last = history[history.length - 1];
  const yearAgo = new Date(last.d); yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const target = yearAgo.toISOString().slice(0, 10);
  const base = history.find(p => p.d >= target) || history[0];
  const days = (new Date(last.d) - new Date(base.d)) / 864e5;
  if (days < 28 || !base.v) return null; // menos de 4 semanas no dice nada
  const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const [y, m] = base.d.split("-");
  return {
    pct: round1((last.v - base.v) / base.v * 100),
    label: days >= 330 ? "en los últimos 12 meses" : `desde ${MESES[+m - 1]} de ${y}`,
  };
}

/* ---------- 6. renovar el token ---------- */
async function refreshToken() {
  const r = await fetch(`${TOKEN_HOST}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(TOKEN)}`);
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body.access_token) throw new Error(body.error?.message || `HTTP ${r.status}`);
  const days = Math.round((body.expires_in || 0) / 86400);
  console.log(`✓ Token renovado (caduca en ${days} días).`);
  if (body.access_token !== TOKEN) await saveSecret("IG_TOKEN", body.access_token);
}

// Guarda el token nuevo como secreto del repositorio para la próxima ejecución.
async function saveSecret(name, value) {
  const pat = process.env.GH_PAT, repo = process.env.GITHUB_REPOSITORY;
  if (!pat || !repo) { console.warn("⚠ Falta GH_PAT: el token nuevo no se ha guardado. Revisa la guía."); return; }
  const gh = (path, init = {}) => fetch(`https://api.github.com/repos/${repo}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(init.headers || {}) },
  });
  const keyRes = await gh("actions/secrets/public-key");
  if (!keyRes.ok) throw new Error(`no se pudo leer la clave del repo (HTTP ${keyRes.status})`);
  const { key, key_id } = await keyRes.json();
  const sodium = createRequire(import.meta.url)("libsodium-wrappers");
  await sodium.ready;
  const sealed = sodium.crypto_box_seal(sodium.from_string(value), sodium.from_base64(key, sodium.base64_variants.ORIGINAL));
  const put = await gh(`actions/secrets/${name}`, {
    method: "PUT",
    body: JSON.stringify({ encrypted_value: sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL), key_id }),
  });
  if (!put.ok) throw new Error(`no se pudo guardar el secreto (HTTP ${put.status})`);
  console.log(`✓ Secreto ${name} actualizado.`);
}

/* ---------- ejecución ---------- */
const prev = await readJson(STATS, {});
let history = await readJson(HISTORY, []);

const profile = await getProfile(); // si esto falla, el token no vale: la tarea falla y GitHub te avisa por email
console.log(`✓ @${profile.username}: ${profile.followers} seguidores`);

const d30 = await safe("alcance 30 días", () => get30Days(profile.id), {});
const eng = await safe("engagement", () => getEngagement(profile.id, profile.followers), null);
const demo = await getDemographics(profile.id);

const day = today();
history = history.filter(p => p.d !== day);
history.push({ d: day, v: profile.followers });
history.sort((a, b) => a.d.localeCompare(b.d));
history = history.slice(-800);

const stats = {
  updated: new Date().toISOString(),
  username: profile.username,
  followers: profile.followers,
  posts: profile.media,
  growth: growthFrom(history),
  history: history.slice(-400),
  reach30: d30.reach30 ?? prev.reach30 ?? null,
  interactions30: d30.interactions30 ?? prev.interactions30 ?? null,
  engaged30: d30.engaged30 ?? prev.engaged30 ?? null,
  engagement: eng ?? prev.engagement ?? {},
  demographics: demo ?? prev.demographics ?? {},
};

await mkdir(DATA_DIR, { recursive: true });
await writeFile(HISTORY, JSON.stringify(history, null, 1) + "\n");
await writeFile(STATS, JSON.stringify(stats, null, 2) + "\n");
console.log("✓ stats.json actualizado.");

await safe("renovar token", refreshToken, null);
