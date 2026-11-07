/**
 * Cron 表达式解析（标准 5 段：分 时 日 月 周）与后续触发时间推算。
 * 推算使用「按天/按小时跳转」的粗筛，不会逐分钟扫一整年。
 */

const MACROS = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

const MONTH_NAMES = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const DOW_NAMES = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

const FIELD_LABELS = ["分钟", "小时", "日", "月", "星期"];

function parseValue(token, names) {
  const lowered = token.toLowerCase();
  if (names && Object.prototype.hasOwnProperty.call(names, lowered)) return names[lowered];
  if (!/^\d{1,2}$/.test(lowered)) return null;
  return Number(lowered);
}

function expandField(text, min, max, names) {
  const values = new Set();
  for (const part of text.split(",")) {
    if (part === "") return { ok: false, error: "字段里有空的列表项" };
    const [rangePart, stepPart] = part.split("/");
    let step = 1;
    if (stepPart !== undefined) {
      if (!/^\d{1,2}$/.test(stepPart) || Number(stepPart) === 0) return { ok: false, error: `步长不合法：${part}` };
      step = Number(stepPart);
    }

    let start;
    let end;
    if (rangePart === "*") {
      start = min;
      end = max;
    } else if (rangePart.includes("-")) {
      const [from, to] = rangePart.split("-");
      start = parseValue(from, names);
      end = parseValue(to, names);
      if (start === null || end === null) return { ok: false, error: `范围不合法：${rangePart}` };
    } else {
      start = parseValue(rangePart, names);
      if (start === null) return { ok: false, error: `数值不合法：${rangePart}` };
      end = stepPart === undefined ? start : max;
    }

    if (start < min || start > max || end < min || end > max) {
      return { ok: false, error: `超出取值范围 ${min}-${max}：${part}` };
    }
    if (start > end) return { ok: false, error: `范围起点大于终点：${part}` };
    for (let value = start; value <= end; value += step) values.add(value);
  }
  return { ok: true, values: [...values].sort((x, y) => x - y) };
}

/**
 * @param {string} expression
 * @returns {{ ok: true, fields: { minute:Set<number>, hour:Set<number>, dayOfMonth:Set<number>,
 *   month:Set<number>, dayOfWeek:Set<number>, dayOfMonthAll:boolean, dayOfWeekAll:boolean },
 *   normalized:string, isMacro:boolean } | { ok: false, error: string }}
 */
export function parseCron(expression) {
  const raw = String(expression ?? "").trim().replace(/\s+/g, " ");
  if (raw === "") return { ok: false, error: "表达式为空" };

  let text = raw;
  let isMacro = false;
  if (raw.startsWith("@")) {
    const expanded = MACROS[raw.toLowerCase()];
    if (!expanded) return { ok: false, error: `不认识的宏：${raw}（支持 @hourly @daily @weekly @monthly @yearly）` };
    text = expanded;
    isMacro = true;
  }

  const parts = text.split(" ");
  if (parts.length === 6) return { ok: false, error: "本工具使用 5 段格式（分 时 日 月 周），不支持秒级 6 段" };
  if (parts.length !== 5) return { ok: false, error: `需要 5 个字段（分 时 日 月 周），现在是 ${parts.length} 个` };

  const specs = [
    { text: parts[0], min: 0, max: 59, names: null },
    { text: parts[1], min: 0, max: 23, names: null },
    { text: parts[2], min: 1, max: 31, names: null },
    { text: parts[3], min: 1, max: 12, names: MONTH_NAMES },
    { text: parts[4], min: 0, max: 7, names: DOW_NAMES },
  ];

  const expanded = [];
  for (let index = 0; index < specs.length; index += 1) {
    const spec = specs[index];
    const result = expandField(spec.text, spec.min, spec.max, spec.names);
    if (!result.ok) return { ok: false, error: `${FIELD_LABELS[index]}字段：${result.error}` };
    expanded.push(result.values);
  }

  const dayOfWeek = new Set(expanded[4].map((value) => (value === 7 ? 0 : value)));
  const fields = {
    minute: new Set(expanded[0]),
    hour: new Set(expanded[1]),
    dayOfMonth: new Set(expanded[2]),
    month: new Set(expanded[3]),
    dayOfWeek,
    dayOfMonthAll: parts[2] === "*",
    dayOfWeekAll: parts[4] === "*",
  };

  return { ok: true, fields, normalized: parts.join(" "), isMacro };
}

function dayMatches(date, fields) {
  const domHit = fields.dayOfMonth.has(date.getDate());
  const dowHit = fields.dayOfWeek.has(date.getDay());
  if (fields.dayOfMonthAll && fields.dayOfWeekAll) return true;
  if (fields.dayOfMonthAll) return dowHit;
  if (fields.dayOfWeekAll) return domHit;
  return domHit || dowHit;
}

function hourMatches(date, fields) {
  return fields.hour.has(date.getHours());
}

/**
 * 推算接下来的触发时间（按本地时区）。
 * @param {string} expression
 * @param {{ from?: number, count?: number, maxYears?: number }} [options]
 */
export function nextRuns(expression, options = {}) {
  const parsed = parseCron(expression);
  if (!parsed.ok) return parsed;

  const count = Math.min(Math.max(1, options.count ?? 5), 20);
  const start = options.from ?? Date.now();
  const limit = new Date(start);
  limit.setFullYear(limit.getFullYear() + (options.maxYears ?? 3));

  const cursor = new Date(start);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);

  const runs = [];
  let guard = 0;

  while (runs.length < count && cursor.getTime() <= limit.getTime() && guard < 200_000) {
    guard += 1;
    const { fields } = parsed;

    if (!fields.month.has(cursor.getMonth() + 1)) {
      cursor.setMonth(cursor.getMonth() + 1, 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }
    if (!dayMatches(cursor, fields)) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }
    if (!hourMatches(cursor, fields)) {
      cursor.setHours(cursor.getHours() + 1, 0, 0, 0);
      continue;
    }
    if (!fields.minute.has(cursor.getMinutes())) {
      cursor.setMinutes(cursor.getMinutes() + 1, 0, 0);
      continue;
    }

    runs.push(cursor.getTime());
    cursor.setMinutes(cursor.getMinutes() + 1, 0, 0);
  }

  return { ok: true, runs, exhausted: runs.length < count, normalized: parsed.normalized };
}

/** 给一段中文说明，只覆盖常见写法，其余返回 null。 */
export function describeCron(expression) {
  const parsed = parseCron(expression);
  if (!parsed.ok) return parsed;
  const { fields } = parsed;
  const minuteList = [...fields.minute].sort((a, b) => a - b);
  const hourList = [...fields.hour].sort((a, b) => a - b);
  const pad = (n) => String(n).padStart(2, "0");
  const everyMinute = minuteList.length === 60;
  const everyHour = hourList.length === 24;
  const basicDay = fields.dayOfMonthAll && fields.dayOfWeekAll && fields.month.size === 12;

  if (everyMinute && everyHour && basicDay) return { ok: true, description: "每分钟触发" };
  if (!everyMinute && everyHour && basicDay && minuteList.length === 1) {
    return { ok: true, description: `每小时第 ${minuteList[0]} 分钟触发` };
  }
  if (!everyMinute && !everyHour && basicDay && minuteList.length === 1 && hourList.length === 1) {
    return { ok: true, description: `每天 ${pad(hourList[0])}:${pad(minuteList[0])} 触发` };
  }
  if (!everyMinute && !everyHour && fields.dayOfMonthAll && fields.month.size === 12 && fields.dayOfWeek.size === 1 && minuteList.length === 1 && hourList.length === 1) {
    const names = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const day = [...fields.dayOfWeek][0];
    return { ok: true, description: `每周${names[day]} ${pad(hourList[0])}:${pad(minuteList[0])} 触发` };
  }
  if (!everyMinute && fields.hour.size === 1 && fields.dayOfMonth.size === 1 && fields.dayOfWeekAll && minuteList.length === 1) {
    return { ok: true, description: `每月 ${fields.dayOfMonth.size === 1 ? [...fields.dayOfMonth][0] : "?"} 日 ${pad([...fields.hour][0])}:${pad(minuteList[0])} 触发` };
  }
  return { ok: true, description: null };
}

/** 把每个字段展开成可展示的文本。 */
export function explainFields(expression) {
  const parsed = parseCron(expression);
  if (!parsed.ok) return parsed;
  const { fields } = parsed;
  return {
    ok: true,
    rows: [
      { label: "分钟", values: [...fields.minute].sort((a, b) => a - b) },
      { label: "小时", values: [...fields.hour].sort((a, b) => a - b) },
      { label: "日", values: [...fields.dayOfMonth].sort((a, b) => a - b) },
      { label: "月", values: [...fields.month].sort((a, b) => a - b) },
      { label: "星期", values: [...fields.dayOfWeek].sort((a, b) => a - b) },
    ],
  };
}
