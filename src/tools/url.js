/**
 * URL 编码 / 解码。支持整段 URL 与查询参数（component）两种模式。
 */

const utf8Loose = new TextDecoder("utf-8");

/** 宽松解码：把 %XX 还原成字节后再按 UTF-8 解码，坏字节显示为替换符而不是整体失败。 */
function lenientDecode(value) {
  const bytes = [];
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char === "%" && /^[0-9a-fA-F]{2}$/.test(value.slice(i + 1, i + 3))) {
      bytes.push(parseInt(value.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      const code = char.codePointAt(0);
      if (code < 0x80) bytes.push(code);
      else bytes.push(...new TextEncoder().encode(char));
    }
  }
  return utf8Loose.decode(Uint8Array.from(bytes));
}

/**
 * @param {string} text
 * @param {{ mode?: "component"|"whole" }} [options]
 */
export function urlEncode(text, options = {}) {
  const mode = options.mode === "whole" ? "whole" : "component";
  const value = String(text ?? "");
  if (mode === "whole") {
    try {
      return { ok: true, output: encodeURI(value), error: null };
    } catch {
      return { ok: true, output: encodeURIComponent(value), error: null };
    }
  }
  return { ok: true, output: encodeURIComponent(value), error: null };
}

/**
 * @param {string} text
 * @param {{ plusAsSpace?: boolean }} [options]
 * @returns {{ ok: true, output: string, recovered: boolean } | { ok: false, output: string, error: string }}
 */
export function urlDecode(text, options = {}) {
  let value = String(text ?? "");
  if (options.plusAsSpace) value = value.replace(/\+/g, " ");
  try {
    return { ok: true, output: decodeURIComponent(value), recovered: false };
  } catch {
    return { ok: true, output: lenientDecode(value), recovered: true };
  }
}
