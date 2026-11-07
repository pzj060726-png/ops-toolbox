/**
 * 时间戳解析与多时区展示。全部基于 Intl，浏览器 / Node 表现一致。
 */

export const COMMON_TIME_ZONES = [
  "Asia/Shanghai",
  "UTC",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
];

const MAX_TIME = 8.64e15;

/** 校验时区是否被当前运行环境支持。 */
export function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function clampInput(input) {
  return String(input ?? "").trim();
}

/**
 * 支持：秒级时间戳、毫秒级时间戳、小数秒、"YYYY-MM-DD HH:mm:ss"、完整 ISO 字符串。
 * @param {string} input
 * @returns {{ ok: true, ms: number, kind: "seconds"|"milliseconds"|"iso"|"date" } | { ok: false, error: string }}
 */
export function parseTimeInput(input) {
  const value = clampInput(input);
  if (value === "") return { ok: false, error: "输入为空" };

  if (/^-?\d+$/.test(value)) {
    const digits = value.replace(/^-/, "").length;
    const number = Number(value);
    if (digits <= 10) return finish(number * 1000, "seconds");
    if (digits <= 16) return finish(number, "milliseconds");
    return { ok: false, error: "数字太长，无法识别为时间戳" };
  }

  if (/^-?\d+\.\d+$/.test(value)) return finish(Number(value) * 1000, "seconds");
  if (/^-?\d+e\d+$/i.test(value)) return finish(Number(value) * 1000, "seconds");

  const isoLike = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.(\d{1,3}))?)?)?$/);
  if (isoLike) {
    const [, y, mo, d, h = "0", mi = "0", s = "0", msPart = "0"] = isoLike;
    const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s), Number(msPart.padEnd(3, "0")));
    if (Number.isNaN(date.getTime())) return { ok: false, error: "日期不合法，例如 2 月 30 日" };
    return finish(date.getTime(), "date");
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return { ok: false, error: "无法识别的时间格式" };
  return finish(parsed, "iso");

  function finish(ms, kind) {
    if (!Number.isFinite(ms) || Math.abs(ms) > MAX_TIME) return { ok: false, error: "时间超出可表示范围" };
    return { ok: true, ms: Math.round(ms), kind };
  }
}

/** ISO 8601 周数（周一为一周开始）。 */
export function isoWeekInfo(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayNumber = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week, year: date.getUTCFullYear() };
}

function zonedParts(ms, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(formatter.formatToParts(ms).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === "24" ? "0" : parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** 按指定时区输出 "YYYY-MM-DD HH:mm:ss"。 */
export function formatInZone(ms, timeZone = "Asia/Shanghai") {
  const zone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const p = zonedParts(ms, zone);
  const pad = (n, width = 2) => String(n).padStart(width, "0");
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
}

/** 时区偏移，例如 "UTC+08:00"。 */
export function zoneOffsetLabel(ms, timeZone) {
  const zone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const p = zonedParts(ms, zone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const offsetMinutes = Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

const WEEKDAY_NAMES = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

/** 人类可读的相对时间。 */
export function humanizeDelta(deltaMs) {
  const abs = Math.abs(deltaMs);
  const suffix = deltaMs >= 0 ? "后" : "前";
  const units = [
    { ms: 1000, name: "秒" },
    { ms: 60_000, name: "分钟" },
    { ms: 3_600_000, name: "小时" },
    { ms: 86_400_000, name: "天" },
    { ms: 604_800_000, name: "周" },
    { ms: 2_592_000_000, name: "个月" },
    { ms: 31_536_000_000, name: "年" },
  ];
  if (abs < 1000) return deltaMs === 0 ? "就是现在" : `刚刚`;
  let chosen = units[0];
  for (const unit of units) if (abs >= unit.ms) chosen = unit;
  const amount = Math.floor(abs / chosen.ms);
  return deltaMs >= 0 ? `${amount} ${chosen.name}${suffix}` : `${amount} ${chosen.name}${suffix}`;
}

/**
 * 一次性拿到时间戳的全部衍生信息。
 * @param {number} ms
 * @param {{ timeZone?: string, now?: number }} [options]
 */
export function timeReport(ms, options = {}) {
  const now = options.now ?? Date.now();
  const timeZone = isValidTimeZone(options.timeZone) ? options.timeZone : "Asia/Shanghai";
  const date = new Date(ms);
  const p = zonedParts(ms, timeZone);
  const week = isoWeekInfo(p.year, p.month, p.day);
  const startOfYear = Date.UTC(p.year, 0, 1);
  const dayOfYear = Math.floor((Date.UTC(p.year, p.month - 1, p.day) - startOfYear) / 86_400_000) + 1;

  return {
    ms,
    seconds: Math.floor(ms / 1000),
    milliseconds: ms,
    local: formatInZone(ms, timeZone),
    timeZone,
    offset: zoneOffsetLabel(ms, timeZone),
    utc: formatInZone(ms, "UTC"),
    iso: date.toISOString(),
    rfc: Number.isNaN(date.getTime()) ? "" : date.toUTCString(),
    weekday: WEEKDAY_NAMES[new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()],
    isoWeek: `${week.year}-W${String(week.week).padStart(2, "0")}`,
    dayOfYear,
    relative: humanizeDelta(ms - now),
    isFuture: ms > now,
  };
}
