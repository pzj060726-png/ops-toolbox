/**
 * JWT 解析（只解码，不验签 —— 验签需要密钥，属于服务端的事）。
 */

const utf8Strict = new TextDecoder("utf-8", { fatal: true });

function decodeBase64Url(segment) {
  const normalized = String(segment).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return { ok: true, text: utf8Strict.decode(bytes) };
  } catch {
    return { ok: false, error: "Base64URL 解码失败" };
  }
}

/** 粗判是不是 JWT 形状（3 段、点分隔）。 */
export function looksLikeJwt(input) {
  const value = String(input ?? "").trim();
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(value);
}

/**
 * @param {string} token
 * @param {{ now?: number }} [options]
 */
export function decodeJwt(token, options = {}) {
  const now = options.now ?? Date.now();
  const value = String(token ?? "").trim().replace(/^Bearer\s+/i, "");
  if (value === "") return { ok: false, error: "输入为空" };

  const segments = value.split(".");
  if (segments.length < 2) return { ok: false, error: "JWT 至少需要 2 段（header.payload）" };
  if (segments.length > 3) return { ok: false, error: "JWT 最多 3 段，检查是否多粘了内容" };

  const headerRaw = decodeBase64Url(segments[0]);
  if (!headerRaw.ok) return { ok: false, error: `Header 解析失败：${headerRaw.error}` };
  const payloadRaw = decodeBase64Url(segments[1]);
  if (!payloadRaw.ok) return { ok: false, error: `Payload 解析失败：${payloadRaw.error}` };

  let header;
  let payload;
  try {
    header = JSON.parse(headerRaw.text);
  } catch {
    return { ok: false, error: "Header 不是合法的 JSON" };
  }
  try {
    payload = JSON.parse(payloadRaw.text);
  } catch {
    return { ok: false, error: "Payload 不是合法的 JSON" };
  }

  const warnings = [];
  const alg = header && header.alg;
  if (!alg) warnings.push("Header 中没有 alg 字段");
  else if (String(alg).toLowerCase() === "none") warnings.push("alg = none，该令牌未签名，切勿用于生产");

  const claims = {
    iss: payload.iss ?? null,
    sub: payload.sub ?? null,
    aud: payload.aud ?? null,
    jti: payload.jti ?? null,
    iat: typeof payload.iat === "number" ? payload.iat : null,
    nbf: typeof payload.nbf === "number" ? payload.nbf : null,
    exp: typeof payload.exp === "number" ? payload.exp : null,
  };

  const lifetime = [];
  if (claims.exp !== null) {
    const expired = claims.exp * 1000 <= now;
    const delta = Math.abs(claims.exp * 1000 - now);
    const amount = delta >= 86_400_000 ? `${Math.round(delta / 86_400_000)} 天` : `${Math.max(1, Math.round(delta / 60_000))} 分钟`;
    lifetime.push({ claim: "exp", status: expired ? "expired" : "valid", label: expired ? `已过期（${amount}前）` : `仍在有效期内（${amount}后过期）` });
    if (expired) warnings.push("令牌已过期");
  }
  if (claims.nbf !== null) {
    const notYet = claims.nbf * 1000 > now;
    lifetime.push({ claim: "nbf", status: notYet ? "pending" : "valid", label: notYet ? "尚未生效" : "已生效" });
    if (notYet) warnings.push("令牌尚未生效（nbf 在未来）");
  }
  if (claims.iat !== null) {
    const future = claims.iat * 1000 > now + 60_000;
    lifetime.push({ claim: "iat", status: future ? "pending" : "valid", label: future ? "签发时间在未来（时钟可能不同步）" : "签发时间正常" });
    if (future) warnings.push("iat 在未来，检查机器时钟");
  }
  if (segments.length === 2) warnings.push("只有 2 段，没有签名部分");

  return {
    ok: true,
    header,
    payload,
    signature: segments[2] ?? "",
    claims,
    lifetime,
    warnings,
    parts: segments.length,
  };
}
