/**
 * 文本统计与行级清洗。
 */

const textEncoder = new TextEncoder();

/** @param {string} text */
export function textStats(text) {
  const value = String(text ?? "");
  const chars = [...value].length;
  const charsNoSpace = [...value.replace(/\s/g, "")].length;
  const lines = value === "" ? 0 : value.split(/\r?\n/).length;
  const nonEmptyLines = value === "" ? 0 : value.split(/\r?\n/).filter((line) => line.trim() !== "").length;
  const cjkChars = (value.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/gu) || []).length;
  const latinWords = (value.match(/[A-Za-z0-9_']+/g) || []).length;
  return {
    chars,
    charsNoSpace,
    bytes: textEncoder.encode(value).length,
    lines,
    nonEmptyLines,
    cjkChars,
    words: latinWords + cjkChars,
  };
}

function toLines(text) {
  const value = String(text ?? "");
  if (value === "") return [];
  const lines = value.split(/\r?\n/);
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function fromLines(lines) {
  return lines.join("\n");
}

/**
 * @param {string} text
 * @param {{ reverse?: boolean, numeric?: boolean, caseInsensitive?: boolean }} [options]
 */
export function sortLines(text, options = {}) {
  const lines = toLines(text);
  let ordered;
  if (options.numeric) {
    ordered = [...lines].sort((a, b) => {
      const numA = Number.parseFloat(a);
      const numB = Number.parseFloat(b);
      const hasA = Number.isFinite(numA);
      const hasB = Number.isFinite(numB);
      if (hasA && hasB && numA !== numB) return numA - numB;
      if (hasA && !hasB) return -1;
      if (!hasA && hasB) return 1;
      return a.localeCompare(b, "zh-Hans-CN", { numeric: true });
    });
  } else {
    ordered = [...lines].sort((a, b) => a.localeCompare(b, "zh-Hans-CN", { numeric: true, sensitivity: options.caseInsensitive ? "accent" : "variant" }));
  }
  if (options.reverse) ordered.reverse();
  return fromLines(ordered);
}

export function dedupeLines(text) {
  const seen = new Set();
  const kept = [];
  let removed = 0;
  for (const line of toLines(text)) {
    if (seen.has(line)) {
      removed += 1;
      continue;
    }
    seen.add(line);
    kept.push(line);
  }
  return { text: fromLines(kept), removed, kept: kept.length };
}

export function removeEmptyLines(text) {
  const lines = toLines(text);
  const kept = lines.filter((line) => line.trim() !== "");
  return { text: fromLines(kept), removed: lines.length - kept.length };
}

export function trimLines(text) {
  return fromLines(toLines(text).map((line) => line.trim()));
}

export function reverseLines(text) {
  return fromLines(toLines(text).reverse());
}
