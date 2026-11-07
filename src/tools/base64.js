/**
 * Base64 编码 / 解码（UTF-8 安全，支持 Base64URL）。
 * 默认 btoa/atob 只认 Latin-1，这里统一走 TextEncoder / TextDecoder。
 */

const textEncoder = new TextEncoder();
const utf8Strict = new TextDecoder("utf-8", { fatal: true });
const utf8Loose = new TextDecoder("utf-8");

function bytesToBinary(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return binary;
}

/** 看起来像不像 Base64 / Base64URL。 */
export function looksLikeBase64(input) {
  const value = String(input ?? "").replace(/\s+/g, "");
  if (value.length < 4 || value.length % 4 === 1) return false;
  return /^[A-Za-z0-9+/=_-]+$/.test(value);
}

/**
 * @param {string} text
 * @param {{ urlSafe?: boolean }} [options]
 */
export function encodeBase64(text, options = {}) {
  const bytes = textEncoder.encode(String(text ?? ""));
  const base64 = btoa(bytesToBinary(bytes));
  if (!options.urlSafe) return base64;
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * @param {string} input
 * @param {{ urlSafe?: boolean|"auto" }} [options]
 * @returns {{ ok: true, text: string, bytes: number, lossy: boolean, urlSafe: boolean }
 *          | { ok: false, error: string }}
 */
export function decodeBase64(input, options = {}) {
  const urlSafeOption = options.urlSafe ?? "auto";
  let value = String(input ?? "").replace(/\s+/g, "");
  if (value === "") return { ok: false, error: "输入为空" };

  const hasUrlChars = /[-_]/.test(value);
  const urlSafe = urlSafeOption === true || (urlSafeOption === "auto" && hasUrlChars);
  if (urlSafe) value = value.replace(/-/g, "+").replace(/_/g, "/");

  const illegal = value.match(/[^A-Za-z0-9+/=]/);
  if (illegal) return { ok: false, error: `包含非法字符「${illegal[0]}」，不是合法的 Base64` };
  if (value.length % 4 === 1) return { ok: false, error: "长度不合法：Base64 长度除以 4 不能余 1" };
  if (value.includes("=") && !/=+$/.test(value)) return { ok: false, error: "填充符「=」只能出现在末尾" };

  const padded = value.padEnd(Math.ceil(value.length / 4) * 4, "=");
  let bytes;
  try {
    const binary = atob(padded);
    bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return { ok: false, error: "不是合法的 Base64 内容" };
  }

  let text;
  let lossy = false;
  try {
    text = utf8Strict.decode(bytes);
  } catch {
    text = utf8Loose.decode(bytes);
    lossy = true;
  }

  return { ok: true, text, bytes: bytes.length, lossy, urlSafe };
}
