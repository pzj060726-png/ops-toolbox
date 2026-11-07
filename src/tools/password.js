/**
 * 随机密码生成（基于 crypto.getRandomValues，拒绝采样消除取模偏差）。
 */

export const CHARSET_POOLS = {
  lower: "abcdefghijkmnopqrstuvwxyz",
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  digits: "23456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?/",
};

const AMBIGUOUS_MAP = {
  l: "L",
  I: "1",
  "1": "l",
  O: "0",
  "0": "O",
  o: "0",
};

function randomBelow(max) {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi || typeof cryptoApi.getRandomValues !== "function") {
    throw new Error("当前环境不支持 crypto.getRandomValues");
  }
  const buffer = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / max) * max;
  let value;
  do {
    cryptoApi.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return value % max;
}

function pick(pool) {
  return pool[randomBelow(pool.length)];
}

/**
 * @param {{ length?: number, lower?: boolean, upper?: boolean, digits?: boolean,
 *   symbols?: boolean, excludeAmbiguous?: boolean }} [options]
 */
export function generatePassword(options = {}) {
  const length = Math.min(Math.max(Math.floor(Number(options.length ?? 16)), 4), 128);
  const enabled = {
    lower: options.lower !== false,
    upper: options.upper !== false,
    digits: options.digits !== false,
    symbols: options.symbols === true,
  };

  let pools = Object.entries(CHARSET_POOLS)
    .filter(([key]) => enabled[key])
    .map(([, pool]) => pool);

  if (pools.length === 0) return { ok: false, error: "至少要选择一种字符类型" };

  const filter = (pool) =>
    options.excludeAmbiguous === false
      ? pool
      : [...pool].filter((char) => !(char in AMBIGUOUS_MAP)).join("");

  pools = pools.map(filter).filter((pool) => pool.length > 0);
  if (pools.length === 0) return { ok: false, error: "字符池被过滤空了，调整一下选项" };

  const all = pools.join("");
  const required = Math.min(pools.length, length);

  const chars = [];
  for (let index = 0; index < required; index += 1) chars.push(pick(pools[index]));
  while (chars.length < length) chars.push(pick(all));

  // Fisher-Yates 洗牌，避免前几位总是固定类型
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swap = randomBelow(index + 1);
    [chars[index], chars[swap]] = [chars[swap], chars[index]];
  }

  const entropyBits = Math.round(length * Math.log2(all.length));
  const strength = entropyBits >= 128 ? "极强" : entropyBits >= 90 ? "强" : entropyBits >= 60 ? "中等" : "偏弱";

  return { ok: true, password: chars.join(""), entropyBits, strength, alphabetSize: all.length };
}

export function generatePasswords(count, options) {
  const total = Math.min(Math.max(Math.floor(count), 1), 20);
  const items = [];
  for (let index = 0; index < total; index += 1) items.push(generatePassword(options));
  return items;
}
