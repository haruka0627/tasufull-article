/**
 * キャラ seed フォーム反映ロジックの単体テスト（Node）
 */
function setFormFieldValue(existing, value, overwriteAll) {
  const next = String(value || "").trim();
  if (!next) return { value: existing, changed: false };
  if (existing && !overwriteAll) return { value: existing, changed: false };
  return { value: next, changed: true };
}

function applySeed(seed, fields, overwriteAll) {
  let applied = 0;
  const map = [
    ["name", seed.name],
    ["personality", seed.personality],
    ["purpose", seed.purpose],
  ];
  map.forEach(([key, val]) => {
    const r = setFormFieldValue(fields[key], val, overwriteAll);
    if (r.changed) {
      fields[key] = r.value;
      applied += 1;
    }
  });
  return applied;
}

const fields = { name: "既存名", personality: "", purpose: "相談" };
const seed = {
  name: "木乃花",
  personality: "穏やか",
  purpose: "日常会話",
};

const a = applySeed(seed, fields, false);
const fields2 = { name: "既存名", personality: "", purpose: "相談" };
const b = applySeed(seed, fields2, true);

console.log("empty-only:", a, fields.name === "既存名" && fields.personality === "穏やか");
console.log("overwrite:", b === 3);

const pass =
  a === 1 &&
  fields.name === "既存名" &&
  fields.personality === "穏やか" &&
  b === 3 &&
  fields2.name === "木乃花";
process.exit(pass ? 0 : 1);
