/**
 * 编码类工具：HTML 实体、Unicode 转义、十六进制、乱码修复（按字符集重新解码）。
 */

const textEncoder = new TextEncoder();
const utf8Loose = new TextDecoder("utf-8");

export const CHARSETS = [
  { id: "gbk", label: "GBK（简体中文，老式 Windows）" },
  { id: "gb18030", label: "GB18030（简体中文，超集）" },
  { id: "big5", label: "Big5（繁体中文）" },
  { id: "shift_jis", label: "Shift_JIS（日文）" },
  { id: "euc-kr", label: "EUC-KR（韩文）" },
  { id: "windows-1252", label: "Windows-1252（西文）" },
  { id: "iso-8859-1", label: "ISO-8859-1（Latin-1）" },
];

export function isCharsetSupported(charset) {
  try {
    new TextDecoder(charset);
    return true;
  } catch {
    return false;
  }
}

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  copy: "\u00a9",
  reg: "\u00ae",
  trade: "\u2122",
  hellip: "\u2026",
  mdash: "\u2014",
  ndash: "\u2013",
  times: "\u00d7",
  divide: "\u00f7",
  laquo: "\u00ab",
  raquo: "\u00bb",
  middot: "\u00b7",
};

export function htmlEscape(text) {
  return String(text ?? "").replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}

export function htmlUnescape(text) {
  return String(text ?? "").replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body) => {
    if (body[0] === "#") {
      const isHex = body[1] === "x" || body[1] === "X";
      const code = Number.parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, body) ? NAMED_ENTITIES[body] : whole;
  });
}

/** 非 ASCII 字符转成 \uXXXX（超过 0xFFFF 用 \u{...}）。 */
export function unicodeEscape(text) {
  let output = "";
  for (const char of String(text ?? "")) {
    const code = char.codePointAt(0);
    if (code >= 0x20 && code <= 0x7e) {
      output += char;
    } else if (code > 0xffff) {
      output += `\\u{${code.toString(16).toUpperCase()}}`;
    } else {
      output += `\\u${code.toString(16).toUpperCase().padStart(4, "0")}`;
    }
  }
  return output;
}

export function unicodeUnescape(text) {
  return String(text ?? "")
    .replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (whole, hex) => {
      const code = Number.parseInt(hex, 16);
      return code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    })
    .replace(/\\u([0-9a-fA-F]{4})/g, (whole, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (whole, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t");
}

/**
 * @param {string} text
 * @param {{ separator?: string, upper?: boolean }} [options]
 */
export function hexEncode(text, options = {}) {
  const separator = options.separator ?? " ";
  const bytes = textEncoder.encode(String(text ?? ""));
  return [...bytes]
    .map((byte) => {
      const hex = byte.toString(16).padStart(2, "0");
      return options.upper ? hex.toUpperCase() : hex;
    })
    .join(separator);
}

/** @returns {{ ok: true, text: string, bytes: number, lossy: boolean } | { ok: false, error: string }} */
export function hexDecode(input) {
  const cleaned = String(input ?? "").replace(/0x|\\x/gi, " ").replace(/[\s,;|]+/g, " ").trim();
  if (cleaned === "") return { ok: false, error: "输入为空" };
  const tokens = cleaned.split(" ");
  const bytes = [];
  for (const token of tokens) {
    if (!/^[0-9a-fA-F]{1,2}$/.test(token)) return { ok: false, error: `不是合法的十六进制字节：${token}` };
    bytes.push(Number.parseInt(token, 16));
  }
  let text;
  let lossy = false;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
  } catch {
    text = utf8Loose.decode(Uint8Array.from(bytes));
    lossy = true;
  }
  return { ok: true, text, bytes: bytes.length, lossy };
}

/**
 * 乱码修复：把文本按 Latin-1 拆回字节，再用目标字符集重新解码。
 * 适用于「GBK 字节被当成 Latin-1/UTF-8 显示」这类乱码。
 * @param {string} text
 * @param {string} charset
 */
export function decodeWithCharset(text, charset) {
  const id = String(charset ?? "").toLowerCase();
  if (!isCharsetSupported(id)) return { ok: false, error: `当前环境不支持字符集：${charset}` };
  const source = String(text ?? "");
  const bytes = new Uint8Array(source.length);
  for (let index = 0; index < source.length; index += 1) bytes[index] = source.charCodeAt(index) & 0xff;
  const decoder = new TextDecoder(id);
  return { ok: true, text: decoder.decode(bytes), charset: id, bytes: bytes.length };
}
