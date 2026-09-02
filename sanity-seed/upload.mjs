#!/usr/bin/env node
/**
 * رفع أصناف قائمة «مشوي» إلى لوحة تحكم Sanity (المشروع 197665fs / production).
 *
 * ما يفعله السكربت:
 *   1. يرفع صور الأطباق من sanity-seed/images/ عبر Assets API (مرة واحدة فقط —
 *      يتعرّف على الصور المرفوعة سابقاً بنفس الاسم ولا يكرّرها).
 *   2. ينشئ إضافات نكهات الشاي (قرفة / هبهان / نعناع) كمستندات `extra` مجانية.
 *   3. ينشئ الأطباق من sanity-seed/dishes.ndjson بـ createIfNotExists —
 *      أي أن أي طبق عدّلته لاحقاً من لوحة التحكم (سعر، وصف، صورة) لن يُلمَس عند إعادة التشغيل.
 *
 * الاستخدام:
 *   SANITY_TOKEN=<رمز بصلاحية Editor> node sanity-seed/upload.mjs            # معاينة فقط (dry-run)
 *   SANITY_TOKEN=<رمز بصلاحية Editor> node sanity-seed/upload.mjs --yes      # التنفيذ الفعلي
 *
 * خيارات:
 *   --project <id>    افتراضي: 197665fs
 *   --dataset <name>  افتراضي: production
 *   --force           إعادة كتابة الأطباق الموجودة (createOrReplace) — احذر: يمسح تعديلات اللوحة
 *
 * لا يحتاج أي تثبيت (npm install) — يعتمد على fetch المدمج في Node 18+.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};

const projectId = arg('project', process.env.SANITY_PROJECT_ID || '197665fs');
const dataset = arg('dataset', process.env.SANITY_DATASET || 'production');
const token = arg('token', process.env.SANITY_TOKEN) || '';
const confirmed = argv.includes('--yes');
const force = argv.includes('--force');
const apiVersion = '2024-01-01';
const base = process.env.SANITY_API_BASE || `https://${projectId}.api.sanity.io/v${apiVersion}`;

const log = (...a) => console.log(...a);
const die = (msg) => { console.error(`✖ ${msg}`); process.exit(1); };

if (!token) die('يلزم رمز وصول: SANITY_TOKEN=<token> (بصلاحية Editor). أنشئه من sanity.io/manage → API → Tokens.');

const authHeaders = { Authorization: `Bearer ${token}` };

async function query(groq, params = {}) {
  const url = new URL(`${base}/data/query/${dataset}`);
  url.searchParams.set('query', groq);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(`$${k}`, JSON.stringify(v));
  const r = await fetch(url, { headers: authHeaders });
  if (!r.ok) throw new Error(`Query failed ${r.status}: ${await r.text()}`);
  return (await r.json()).result;
}

async function mutate(mutations) {
  const r = await fetch(`${base}/data/mutate/${dataset}?returnIds=true`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mutations }),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(`Mutation failed ${r.status}: ${JSON.stringify(body)}`);
  return body;
}

async function uploadImage(filePath) {
  const name = basename(filePath);
  const ext = extname(name).slice(1).toLowerCase();
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  const url = new URL(`${base}/assets/images/${dataset}`);
  url.searchParams.set('filename', name);
  const r = await fetch(url, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': mime },
    body: readFileSync(filePath),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(`Upload failed for ${name}: ${JSON.stringify(body)}`);
  return body.document; // sanity.imageAsset
}

// ---------- 1) الصور ----------
const imagesDir = join(here, 'images');
const imageFiles = existsSync(imagesDir)
  ? readdirSync(imagesDir).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort()
  : [];

// الصور المرفوعة مسبقاً بنفس الاسم (حتى لا تتكرر عند إعادة التشغيل)
const existingAssets = imageFiles.length
  ? await query('*[_type=="sanity.imageAsset" && originalFilename in $names]{_id, originalFilename}', { names: imageFiles })
  : [];
const assetByFile = Object.fromEntries(existingAssets.map((a) => [a.originalFilename, a._id]));

// ---------- 2) الأطباق من ndjson ----------
const ndjsonPath = join(here, 'dishes.ndjson');
if (!existsSync(ndjsonPath)) die(`الملف غير موجود: ${ndjsonPath}`);
const dishes = readFileSync(ndjsonPath, 'utf8')
  .split(/\r?\n/)
  .filter((l) => l.trim())
  .map((l, i) => {
    try { return JSON.parse(l); } catch (e) { die(`سطر ${i + 1} في dishes.ndjson ليس JSON صالحاً: ${e.message}`); }
  });

// تحقق من أن الأقسام المُشار إليها موجودة فعلاً في اللوحة
const catRefs = [...new Set(dishes.map((d) => d.category?._ref).filter(Boolean))];
const cats = await query('*[_type=="category" && _id in $ids]{_id, key, title}', { ids: catRefs });
const catById = Object.fromEntries(cats.map((c) => [c._id, c]));
const missingCats = catRefs.filter((id) => !catById[id]);
if (missingCats.length) die(`أقسام غير موجودة في اللوحة: ${missingCats.join(', ')}\nأنشئها أولاً أو حدّث _ref في dishes.ndjson.`);

const existingDishIds = new Set(await query('*[_type=="dish" && _id in $ids]._id', { ids: dishes.map((d) => d._id) }));

// ---------- 3) إضافات نكهات الشاي (مجانية) ----------
const teaExtras = [
  { _id: 'extra-tea-cinnamon', _type: 'extra', name: 'قرفة', price: 0 },
  { _id: 'extra-tea-cardamom', _type: 'extra', name: 'هبهان', price: 0 },
  { _id: 'extra-tea-mint', _type: 'extra', name: 'نعناع', price: 0 },
];
const existingExtraIds = new Set(await query('*[_type=="extra" && _id in $ids]._id', { ids: teaExtras.map((e) => e._id) }));

// ---------- ملخص ----------
log(`\nالمشروع: ${projectId} / ${dataset}`);
log(`الصور:   ${imageFiles.length} ملف — ${imageFiles.filter((f) => assetByFile[f]).length} مرفوعة مسبقاً، ${imageFiles.filter((f) => !assetByFile[f]).length} سترفع الآن`);
log(`الإضافات: ${teaExtras.length} — ${teaExtras.filter((e) => existingExtraIds.has(e._id)).length} موجودة، ${teaExtras.filter((e) => !existingExtraIds.has(e._id)).length} ستُنشأ`);
log(`الأطباق: ${dishes.length} — ${dishes.filter((d) => existingDishIds.has(d._id)).length} موجودة، ${dishes.filter((d) => !existingDishIds.has(d._id)).length} ستُنشأ${force ? ' (وضع --force: ستُستبدل الموجودة أيضاً)' : ''}\n`);

const byCat = {};
for (const d of dishes) {
  const c = catById[d.category?._ref];
  (byCat[c ? c.title.trim() : '؟'] ||= []).push(`${existingDishIds.has(d._id) ? '=' : '+'} ${d.title}`);
}
for (const [cat, items] of Object.entries(byCat)) {
  log(`  [${cat}]`);
  for (const it of items) log(`     ${it}`);
}

if (!confirmed) {
  log('\nهذه معاينة فقط. أضف --yes للتنفيذ الفعلي.');
  process.exit(0);
}

// ---------- التنفيذ ----------
log('\n⏫ رفع الصور…');
for (const f of imageFiles) {
  if (assetByFile[f]) { log(`   = ${f} (موجودة)`); continue; }
  const asset = await uploadImage(join(imagesDir, f));
  assetByFile[f] = asset._id;
  log(`   + ${f} → ${asset._id}`);
}

// اربط مرجع الصورة الرمزي image-<name> بمعرّف الأصل الحقيقي
const assetIdForPlaceholder = (ref) => {
  const name = ref.replace(/^image-/, '');
  return assetByFile[`${name}.jpg`] || assetByFile[`${name}.jpeg`] || assetByFile[`${name}.png`] || null;
};

const mutations = [];
for (const e of teaExtras) mutations.push({ createIfNotExists: e });

for (const d of dishes) {
  const doc = JSON.parse(JSON.stringify(d));
  if (doc.image?.asset?._ref) {
    const real = assetIdForPlaceholder(doc.image.asset._ref);
    if (real) doc.image.asset._ref = real;
    else { log(`   ⚠ لا توجد صورة للطبق «${doc.title}» (${doc.image.asset._ref}) — سيُنشأ بدون صورة`); delete doc.image; }
  }
  // براد الشاي الأحمر: نكهات اختيارية مجانية
  if (doc._id === 'dish-tea-red') {
    doc.extras = teaExtras.map((e) => ({ _type: 'reference', _ref: e._id, _key: e._id }));
  }
  mutations.push(force ? { createOrReplace: doc } : { createIfNotExists: doc });
}

log(`\n📝 كتابة ${mutations.length} مستند…`);
const res = await mutate(mutations);
const created = (res.results || []).filter((r) => r.operation === 'create').length;
const updated = (res.results || []).filter((r) => r.operation === 'update').length;
log(`✅ تم. أُنشئ ${created} مستند${updated ? `، وحُدّث ${updated}` : ''}. (transactionId: ${res.transactionId})`);
log('   افتح لوحة التحكم لضبط الأسعار — سيعرض الموقع «السعر عند الطلب» حتى تُدخل السعر.');
