/**
 * 正则测试：匹配列表、分组、替换预览。
 * 未写 "g" 也会自动加上，便于一次性列出全部匹配。
 */

const ALLOWED_FLAGS = new Set(["d", "g", "i", "m", "s", "u", "v", "y"]);

function normalizeFlags(flags) {
  const raw = String(flags ?? "").replace(/\s+/g, "");
  const invalid = [...raw].filter((flag) => !ALLOWED_FLAGS.has(flag));
  if (invalid.length > 0) return { ok: false, error: `不支持的正则标志：${invalid.join(" ")}` };
  const set = new Set(raw);
  set.add("g");
  return { ok: true, flags: [...set].join("") };
}

/**
 * @param {string} pattern
 * @param {string} flags
 * @param {string} text
 * @param {{ maxMatches?: number }} [options]
 */
export function testRegex(pattern, flags, text, options = {}) {
  if (String(pattern ?? "") === "") return { ok: false, error: "正则为空" };
  const normalized = normalizeFlags(flags);
  if (!normalized.ok) return normalized;

  let regex;
  try {
    regex = new RegExp(pattern, normalized.flags);
  } catch (error) {
    return { ok: false, error: String(error && error.message ? error.message : error) };
  }

  const maxMatches = options.maxMatches ?? 500;
  const source = String(text ?? "");
  const matches = [];
  let truncated = false;
  let guard = 0;

  while (guard < maxMatches * 4) {
    guard += 1;
    const match = regex.exec(source);
    if (!match) break;
    if (matches.length >= maxMatches) {
      truncated = true;
      break;
    }
    const named = match.groups ? { ...match.groups } : null;
    matches.push({
      index: match.index,
      end: match.index + match[0].length,
      value: match[0],
      groups: match.slice(1),
      named,
    });
    if (match[0] === "") regex.lastIndex += 1;
    if (regex.lastIndex > source.length) break;
  }

  return { ok: true, matches, truncated, flags: normalized.flags };
}

/** 替换预览（不会修改原文本）。 */
export function replaceRegex(pattern, flags, text, replacement) {
  if (String(pattern ?? "") === "") return { ok: false, error: "正则为空" };
  const normalized = normalizeFlags(flags);
  if (!normalized.ok) return normalized;
  try {
    const regex = new RegExp(pattern, normalized.flags);
    return { ok: true, output: String(text ?? "").replace(regex, String(replacement ?? "")) };
  } catch (error) {
    return { ok: false, error: String(error && error.message ? error.message : error) };
  }
}
