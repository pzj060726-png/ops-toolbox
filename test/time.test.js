import test from "node:test";
import assert from "node:assert/strict";
import { parseTimeInput, formatInZone, isoWeekInfo, zoneOffsetLabel, timeReport, humanizeDelta, parseTimeInput as parse } from "../src/tools/time.js";

test("10 位数字按秒，13 位按毫秒", () => {
  assert.deepEqual(parse("1700000000"), { ok: true, ms: 1700000000000, kind: "seconds" });
  assert.deepEqual(parse("1700000000000"), { ok: true, ms: 1700000000000, kind: "milliseconds" });
  assert.equal(parse("1700000000.5").ms, 1700000000500);
});

test("本地时间字符串按本地时区解析", () => {
  const parsed = parse("2024-01-02 03:04:05");
  assert.equal(parsed.ok, true);
  assert.equal(parsed.kind, "date");
  const date = new Date(parsed.ms);
  assert.equal(date.getFullYear(), 2024);
  assert.equal(date.getMonth(), 0);
  assert.equal(date.getDate(), 2);
  assert.equal(date.getHours(), 3);
});

test("非法输入不会抛异常", () => {
  assert.equal(parse("").ok, false);
  assert.equal(parse("abc").ok, false);
  assert.equal(parse("999999999999999999999").ok, false);
});

test("按时区格式化", () => {
  assert.equal(formatInZone(0, "UTC"), "1970-01-01 00:00:00");
  assert.equal(formatInZone(0, "Asia/Shanghai"), "1970-01-01 08:00:00");
  assert.equal(formatInZone(1700000000000, "Asia/Shanghai"), "2023-11-15 06:13:20");
});

test("时区偏移标签", () => {
  assert.equal(zoneOffsetLabel(0, "Asia/Shanghai"), "UTC+08:00");
  assert.equal(zoneOffsetLabel(0, "UTC"), "UTC+00:00");
});

test("ISO 周数", () => {
  assert.deepEqual(isoWeekInfo(2024, 1, 1), { week: 1, year: 2024 });
  assert.deepEqual(isoWeekInfo(2021, 1, 1), { week: 53, year: 2020 });
  assert.deepEqual(isoWeekInfo(2024, 12, 31), { week: 1, year: 2025 });
});

test("相对时间描述", () => {
  assert.equal(humanizeDelta(0), "就是现在");
  assert.equal(humanizeDelta(90_000), "1 分钟后");
  assert.equal(humanizeDelta(-8 * 86_400_000), "1 周前");
});

test("timeReport 汇总主要字段", () => {
  const report = timeReport(1700000000000, { now: 1700000000000, timeZone: "Asia/Shanghai" });
  assert.equal(report.local, "2023-11-15 06:13:20");
  assert.equal(report.utc, "2023-11-14 22:13:20");
  assert.equal(report.seconds, 1700000000);
  assert.equal(report.iso, "2023-11-14T22:13:20.000Z");
  assert.equal(report.weekday, "星期三");
  assert.equal(report.isoWeek, "2023-W46");
  assert.equal(report.dayOfYear, 319);
  assert.equal(report.relative, "就是现在");
});

test("非法时区回退到 UTC", () => {
  assert.equal(formatInZone(0, "Not/AZone"), "1970-01-01 00:00:00");
});
