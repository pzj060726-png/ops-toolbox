/**
 * IPv4 子网计算：网络号 / 广播地址 / 可用主机范围 / 子网划分。
 * 全程使用无符号 32 位整数，避免 JS 位运算的符号位陷阱。
 */

const SPECIAL_RANGES = [
  { network: 0, prefix: 8, name: "本网络（0.0.0.0/8）" },
  { network: parseIPv4Unsafe("10.0.0.0"), prefix: 8, name: "私有地址 A 类（10.0.0.0/8）" },
  { network: parseIPv4Unsafe("100.64.0.0"), prefix: 10, name: "运营商级 NAT（100.64.0.0/10）" },
  { network: parseIPv4Unsafe("127.0.0.0"), prefix: 8, name: "回环地址（127.0.0.0/8）" },
  { network: parseIPv4Unsafe("169.254.0.0"), prefix: 16, name: "链路本地（169.254.0.0/16）" },
  { network: parseIPv4Unsafe("172.16.0.0"), prefix: 12, name: "私有地址 B 类（172.16.0.0/12）" },
  { network: parseIPv4Unsafe("192.0.2.0"), prefix: 24, name: "文档示例（192.0.2.0/24）" },
  { network: parseIPv4Unsafe("192.168.0.0"), prefix: 16, name: "私有地址 C 类（192.168.0.0/16）" },
  { network: parseIPv4Unsafe("198.18.0.0"), prefix: 15, name: "基准测试（198.18.0.0/15）" },
  { network: parseIPv4Unsafe("224.0.0.0"), prefix: 4, name: "组播（224.0.0.0/4）" },
  { network: parseIPv4Unsafe("240.0.0.0"), prefix: 4, name: "保留（240.0.0.0/4）" },
];

function parseIPv4Unsafe(text) {
  const parts = text.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/** "192.168.1.1" -> 无符号整数；非法返回 null。 */
export function parseIPv4(text) {
  const value = String(text ?? "").trim();
  const match = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/** 无符号整数 -> "192.168.1.1"。 */
export function ipv4ToString(number) {
  const n = Number(number) >>> 0;
  return `${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
}

export function prefixToMask(prefix) {
  if (prefix === 0) return 0;
  return (0xffffffff << (32 - prefix)) >>> 0;
}

export function prefixToWildcard(prefix) {
  return ~prefixToMask(prefix) >>> 0;
}

export function maskToPrefix(mask) {
  let bits = 0;
  let seenZero = false;
  for (let i = 31; i >= 0; i -= 1) {
    const bit = (mask >>> i) & 1;
    if (bit === 1) {
      if (seenZero) return null;
      bits += 1;
    } else {
      seenZero = true;
    }
  }
  return bits;
}

function describeSpecial(network, prefix) {
  for (const range of SPECIAL_RANGES) {
    const rangeMask = prefixToMask(range.prefix);
    if (range.prefix <= prefix && (network & rangeMask) >>> 0 === range.network) return range.name;
  }
  return null;
}

/**
 * @param {string} input "192.168.1.10/24" 或 "192.168.1.10"
 * @returns {{ ok: true, ip: string, prefix: number, network: string, broadcast: string, mask: string,
 *   wildcard: string, firstHost: string|null, lastHost: string|null, hostCount: number,
 *   totalAddresses: number, cidr: string, ipInNetwork: boolean, special: string|null }
 *   | { ok: false, error: string }}
 */
export function analyzeCidr(input) {
  const raw = String(input ?? "").trim();
  if (raw === "") return { ok: false, error: "输入为空" };
  if (raw.includes(":")) return { ok: false, error: "暂不支持 IPv6，当前版本只处理 IPv4" };

  const [ipPart, prefixPart = "32", ...rest] = raw.split("/");
  if (rest.length > 0) return { ok: false, error: "格式应为 192.168.1.0/24" };

  const ip = parseIPv4(ipPart);
  if (ip === null) return { ok: false, error: `无效的 IPv4 地址：${ipPart.trim()}` };

  if (!/^\d{1,2}$/.test(String(prefixPart).trim())) return { ok: false, error: `无效的前缀长度：${prefixPart}` };
  const prefix = Number(String(prefixPart).trim());
  if (prefix < 0 || prefix > 32) return { ok: false, error: "前缀长度必须在 0 到 32 之间" };

  const mask = prefixToMask(prefix);
  const wildcard = prefixToWildcard(prefix);
  const network = (ip & mask) >>> 0;
  const broadcast = (network | wildcard) >>> 0;
  const total = 2 ** (32 - prefix);

  let hostCount;
  let firstHost;
  let lastHost;
  if (prefix === 32) {
    hostCount = 1;
    firstHost = network;
    lastHost = network;
  } else if (prefix === 31) {
    hostCount = 2;
    firstHost = network;
    lastHost = broadcast;
  } else {
    hostCount = total - 2;
    firstHost = network + 1;
    lastHost = broadcast - 1;
  }

  return {
    ok: true,
    ip: ipv4ToString(ip),
    prefix,
    cidr: `${ipv4ToString(network)}/${prefix}`,
    network: ipv4ToString(network),
    broadcast: ipv4ToString(broadcast),
    mask: ipv4ToString(mask),
    wildcard: ipv4ToString(wildcard),
    firstHost: firstHost === null ? null : ipv4ToString(firstHost),
    lastHost: lastHost === null ? null : ipv4ToString(lastHost),
    hostCount,
    totalAddresses: total,
    ipInNetwork: (ip & mask) >>> 0 === network,
    special: describeSpecial(network, prefix),
  };
}

/** 把 cidr 切分成更长前缀的等长子网。 */
export function splitSubnets(input, newPrefix, options = {}) {
  const base = analyzeCidr(input);
  if (!base.ok) return base;
  const maxRows = options.maxRows ?? 1024;
  if (!Number.isInteger(newPrefix) || newPrefix < base.prefix || newPrefix > 32) {
    return { ok: false, error: `目标前缀必须在 ${base.prefix} 到 32 之间` };
  }
  const count = 2 ** (newPrefix - base.prefix);
  if (count > maxRows) {
    return { ok: false, error: `会切出 ${count} 个子网，超过一次最多展示的 ${maxRows} 个` };
  }
  const step = 2 ** (32 - newPrefix);
  const start = parseIPv4(base.network);
  const rows = [];
  for (let index = 0; index < count; index += 1) {
    const network = (start + index * step) >>> 0;
    const broadcast = (network + step - 1) >>> 0;
    const single = newPrefix >= 31;
    rows.push({
      index: index + 1,
      cidr: `${ipv4ToString(network)}/${newPrefix}`,
      network: ipv4ToString(network),
      broadcast: ipv4ToString(broadcast),
      firstHost: ipv4ToString(single ? network : network + 1),
      lastHost: ipv4ToString(single ? broadcast : broadcast - 1),
      hostCount: single ? step : step - 2,
    });
  }
  return { ok: true, base: base.cidr, newPrefix, count, rows };
}
