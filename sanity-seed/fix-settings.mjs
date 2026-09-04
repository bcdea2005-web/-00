#!/usr/bin/env node
/**
 * توحيد مستندات «إعدادات الموقع» (siteSettings) في مشروع Sanity (197665fs / production).
 *
 * المشكلة التي يعالجها هذا السكربت:
 *   وُجد مستندان من نوع siteSettings في قاعدة البيانات. اللوحة كانت تعدّل أحدهما
 *   والموقع يقرأ `*[_type=="siteSettings"][0]` أي الأقدم — لذلك كان تغيير الخلفية
 *   (أو حذفها) من لوحة التحكم لا يظهر أبداً على الموقع («صورة عالقة»).
 *
 * ما يفعله السكربت (بعد --yes):
 *   1. يقرأ كل مستندات siteSettings المنشورة.
 *   2. يختار المستند المفرد الموحّد `_id == "siteSettings"` (الذي تثبّته هيكلة اللوحة —
 *      انظر studio/sanity.config.js — والذي يفضّله استعلام الموقع).
 *   3. ينسخ أي حقول مفقودة فيه من المستندات الأخرى (الأحدث تعديلاً أولاً) —
 *      لا يمسح أي قيمة موجودة فيه، وصورة الخلفية التي رفعتَها آخر مرة تبقى كما هي.
 *   4. يتحقق أنه لن تُفقد أي قيمة لأي حقل، ثم يحذف المستندات المكررة.
 *
 * الاستخدام:
 *   SANITY_TOKEN=<رمز بصلاحية Editor> node sanity-seed/fix-settings.mjs           # معاينة فقط (dry-run)
 *   SANITY_TOKEN=<رمز بصلاحية Editor> node sanity-seed/fix-settings.mjs --yes     # التنفيذ الفعلي
 *
 * خيارات:
 *   --project <id>    افتراضي: 197665fs
 *   --dataset <name>  افتراضي: production
 *
 * لا يحتاج npm install — يعتمد على fetch المدمج في Node 18+.
 * أنشئ الرمز من https://www.sanity.io/manage → المشروع → API → Tokens.
 */

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};

const projectId = arg('project', process.env.SANITY_PROJECT_ID || '197665fs');
const dataset = arg('dataset', process.env.SANITY_DATASET || 'production');
const token = arg('token', process.env.SANITY_TOKEN) || '';
const confirmed = argv.includes('--yes');
const apiVersion = '2024-01-01';
const base = process.env.SANITY_API_BASE || `https://${projectId}.api.sanity.io/v${apiVersion}`;

const CANONICAL_ID = 'siteSettings';
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

const isDraft = (id) => id.startsWith('drafts.');
const stripSystem = (doc) => Object.fromEntries(Object.entries(doc).filter(([k]) => !k.startsWith('_')));
const nonEmpty = (v) => {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};
const fieldSummary = (v) => {
  if (v == null) return '(فارغ)';
  if (typeof v === 'string') return v.length > 40 ? v.slice(0, 40) + '…' : v;
  if (Array.isArray(v)) return `مصفوفة (${v.length} عنصر)`;
  if (typeof v === 'object' && v.asset) return 'صورة ✓';
  if (typeof v === 'object') return `كائن (${Object.keys(v).length} مفتاح)`;
  return String(v);
};

// ---------- التنفيذ ----------
log(`\n🔎 قراءة مستندات siteSettings من ${projectId} / ${dataset} …`);
const docs = (await query('*[_type=="siteSettings" && !(_id in path("drafts.**"))]')) || [];
const drafts = (await query('*[_id in path("drafts.*") && _type=="siteSettings"]{_id}')) || [];
log(`   وجد: ${docs.length} مستند منشور${drafts.length ? ` (+ ${drafts.length} مسودة تُركت دون مساس)` : ''}:`);
for (const d of docs) {
  log(`    - ${d._id}${d._id === CANONICAL_ID ? '  ← المستند المفرد المطلوب' : ''}  (آخر تعديل: ${d._updatedAt || '؟'})`);
}

if (docs.length === 0) {
  log('\nℹ لا يوجد أي مستند siteSettings بعد. أنشئ/حرّر «إعدادات الموقع» من اللوحة —');
  log('  هيكلتها الجديدة تفتح المستند الثابت siteSettings تلقائياً. لا حاجة لهذا السكربت.');
  process.exit(0);
}

// المستند الموحّد: الذي معرّفه siteSettings إن وُجد، وإلا سننشئه من دمج البقية.
let canonical = docs.find((d) => d._id === CANONICAL_ID) || null;
const donors = docs.filter((d) => d._id !== CANONICAL_ID);

if (docs.length === 1 && canonical) {
  log('\n✅ لا يوجد تكرار: مستند واحد فقط وبالمعرّف الصحيح. لا شيء يُفعل.');
  if (!nonEmpty(canonical.heroBackground)) log('   (تنبيه: لا توجد صورة خلفية — الموقع يعرض الشعار الافتراضي، وهذا مقصود).');
  process.exit(0);
}

// ---------- الدمج: القيم الحالية في المستند الموحّد لا تُمس ----------
const merged = { ...(canonical ? stripSystem(canonical) : {}) };
const byRecency = [...donors].sort((a, b) => String(b._updatedAt || '').localeCompare(String(a._updatedAt || '')));
const added = [];
for (const donor of byRecency) {
  for (const [k, v] of Object.entries(stripSystem(donor))) {
    if (nonEmpty(v) && !nonEmpty(merged[k])) {
      merged[k] = v;
      added.push({ field: k, from: donor._id });
    }
  }
}

// تغطية: هل ستُفقد أي قيمة لأي حقل عند حذف المكرّرات؟
const lost = [];
for (const donor of donors) {
  for (const [k, v] of Object.entries(stripSystem(donor))) {
    if (nonEmpty(v) && !nonEmpty(merged[k])) lost.push({ field: k, from: donor._id });
  }
}

// ---------- الملخص ----------
log('\n📋 خطة التوحيد:');
log(`   المستند النهائي: ${CANONICAL_ID}${canonical ? ' (موجود)' : ' (سيُنشأ الآن بكل الحقول المدموجة)'}`);
if (added.length) {
  log('   حقول ستُضاف إليه من المستندات المكررة:');
  for (const a of added) log(`    + ${a.field}: ${fieldSummary(merged[a.field])}  (من ${a.from})`);
} else {
  log('   لا توجد حقول مفقودة تُضاف — بيانات المستند الموحّد كاملة.');
}
log('   الحقول في النسخة النهائية:');
for (const [k, v] of Object.entries(merged)) log(`    • ${k}: ${fieldSummary(v)}`);
log(`   مستندات ستُحذف بعد الدمج: ${donors.map((d) => d._id).join(' , ')}${donors.length ? '' : ' (لا شيء)'}`);
if (lost.length) {
  log('\n⚠ تحذير: هذه الحقول ستُفقد تماماً إن حُذفت المكررات (لم تُنسخ):');
  for (const l of lost) log(`    ✗ ${l.field} (من ${l.from})`);
}

if (!confirmed) {
  log('\nهذه معاينة فقط. أضف --yes للتنفيذ الفعلي.');
  process.exit(0);
}

const mutations = [];
if (canonical) {
  const additions = added.length
    ? Object.fromEntries(added.map((a) => [a.field, merged[a.field]]))
    : null;
  if (additions) {
    mutations.push({ patch: { id: CANONICAL_ID, set: additions } });
    log(`\n✏️  تحديث ${CANONICAL_ID} بـ ${Object.keys(additions).length} حقل/حقول …`);
  } else {
    log(`\nℹ ${CANONICAL_ID} لا يحتاج أي تحديث.`);
  }
} else {
  mutations.push({ createIfNotExists: { _id: CANONICAL_ID, _type: 'siteSettings', ...merged } });
  log(`\n✨ إنشاء ${CANONICAL_ID} بالحقول المدموجة …`);
}

if (mutations.length) {
  await mutate(mutations);
  log('   ✅ تم الحفظ.');
}

// فحص التغطية قبل الحذف — لن تحذف شيئاً إن بقيت قيمة مفقودة.
if (lost.length) {
  console.error('\n⚠ توقّف الحذف حفاظاً على البيانات: بعض الحقول ستُفقد (راجع التحذير بالأعلى).');
  console.error('   النسخ/التحديث طُبّق، لكن المستندات المكررة تُركت كما هي. أعد التشغيل بعد مراجعة الحقول.');
  process.exit(1);
}

// حذف المكررات (مع مسودّاتها لئلا تبقى أشباح في اللوحة — حذف مُعرّف غير موجود ناجح بلا أثر).
const deleteIds = donors.map((d) => d._id).filter((id) => !isDraft(id));
if (deleteIds.length) {
  await mutate(deleteIds.flatMap((id) => [id, `drafts.${id}`]).map((id) => ({ delete: { id } })));
  log(`🗑  حُذف: ${deleteIds.join(' , ')}`);
}

// تحقق نهائي
const after = (await query('*[_type=="siteSettings" && !(_id in path("drafts.**"))]{_id}')) || [];
log(`\n🏁 بعد التنفيذ: ${after.length} مستند siteSettings → ${after.map((d) => d._id).join(' , ')}`);
if (after.length === 1 && after[0]._id === CANONICAL_ID) {
  log('✅ اكتمل التوحيد. الموقع واللوحة يقرآن الآن المستند نفسه — غيّر الخلفية أو امسحها من');
  log('   «إعدادات الموقع» وستنعكس فوراً على الموقع.');
} else {
  log('⚠ النتيجة غير متوقعة — راجع الناتج أعلاه.');
  process.exit(1);
}
