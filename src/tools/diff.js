/**
 * 行级文本 Diff（LCS）。
 * 先裁剪公共前后缀，再对中间部分做动态规划，避免整篇矩阵。
 */

function splitLines(text) {
  const value = String(text ?? "");
  const lines = value.split(/\r?\n/);
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/**
 * @param {string} before
 * @param {string} after
 * @param {{ maxCells?: number }} [options]
 * @returns {{ ok: true, ops: Array<{type:"equal"|"add"|"del", text:string, oldLine:number|null, newLine:number|null}>,
 *   stats: { added:number, removed:number, unchanged:number } } | { ok: false, error: string }}
 */
export function diffLines(before, after, options = {}) {
  const a = splitLines(before);
  const b = splitLines(after);
  const maxCells = options.maxCells ?? 1_500_000;

  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix += 1;

  let suffix = 0;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) suffix += 1;

  const aMid = a.slice(prefix, a.length - suffix);
  const bMid = b.slice(prefix, b.length - suffix);
  const n = aMid.length;
  const m = bMid.length;

  if (n * m > maxCells) {
    return { ok: false, error: `待比较的中间部分太大（${n} × ${m}），请先缩小文本范围` };
  }

  const width = m + 1;
  const table = new Int32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i * width + j] = aMid[i] === bMid[j]
        ? table[(i + 1) * width + j + 1] + 1
        : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }

  const ops = [];
  let oldLine = 1;
  for (let k = 0; k < prefix; k += 1) {
    ops.push({ type: "equal", text: a[k], oldLine, newLine: oldLine });
    oldLine += 1;
  }

  let i = 0;
  let j = 0;
  let newLine = oldLine;
  while (i < n && j < m) {
    if (aMid[i] === bMid[j]) {
      ops.push({ type: "equal", text: aMid[i], oldLine, newLine });
      i += 1;
      j += 1;
      oldLine += 1;
      newLine += 1;
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      ops.push({ type: "del", text: aMid[i], oldLine, newLine: null });
      i += 1;
      oldLine += 1;
    } else {
      ops.push({ type: "add", text: bMid[j], oldLine: null, newLine });
      j += 1;
      newLine += 1;
    }
  }
  while (i < n) {
    ops.push({ type: "del", text: aMid[i], oldLine, newLine: null });
    i += 1;
    oldLine += 1;
  }
  while (j < m) {
    ops.push({ type: "add", text: bMid[j], oldLine: null, newLine });
    j += 1;
    newLine += 1;
  }

  for (let k = a.length - suffix; k < a.length; k += 1) {
    ops.push({ type: "equal", text: a[k], oldLine, newLine });
    oldLine += 1;
    newLine += 1;
  }

  const stats = { added: 0, removed: 0, unchanged: 0 };
  for (const op of ops) stats[op.type === "equal" ? "unchanged" : op.type === "add" ? "added" : "removed"] += 1;

  return { ok: true, ops, stats, identical: stats.added === 0 && stats.removed === 0 };
}
