import test from "node:test";
import assert from "node:assert/strict";
import { parseCron, nextRuns, describeCron, explainFields } from "../src/tools/cron.js";

test("通配符与步长", () => {
  const parsed = parseCron("*/15 * * * *");
  assert.equal(parsed.ok, true);
  assert.deepEqual([...parsed.fields.minute], [0, 15, 30, 45]);
  assert.equal(parsed.fields.hour.size, 24);
});

test("范围、列表与名字", () => {
  const parsed = parseCron("0 9-17 * * MON-FRI");
  assert.equal(parsed.ok, true);
  assert.deepEqual([...parsed.fields.hour], [9, 10, 11, 12, 13, 14, 15, 16, 17]);
  assert.deepEqual([...parsed.fields.dayOfWeek], [1, 2, 3, 4, 5]);
});

test("星期 7 归一为 0", () => {
  const parsed = parseCron("0 0 * * 7");
  assert.deepEqual([...parsed.fields.dayOfWeek], [0]);
});

test("宏展开", () => {
  const parsed = parseCron("@daily");
  assert.equal(parsed.ok, true);
  assert.equal(parsed.isMacro, true);
  assert.equal(parsed.normalized, "0 0 * * *");
});

test("常见错误有中文提示", () => {
  assert.match(parseCron("").error, /为空/);
  assert.match(parseCron("0 0 * * * *").error, /5 段/);
  assert.match(parseCron("0 0 * *").error, /5 个字段/);
  assert.match(parseCron("60 0 * * *").error, /分钟字段/);
  assert.match(parseCron("0 24 * * *").error, /小时字段/);
  assert.match(parseCron("@nope").error, /宏/);
  assert.match(parseCron("0 0 * * 1-*").error, /范围/);
});

test("推算每小时触发", () => {
  const from = new Date(2024, 0, 1, 10, 30, 0).getTime();
  const result = nextRuns("0 * * * *", { from, count: 3 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.runs, [
    new Date(2024, 0, 1, 11, 0, 0).getTime(),
    new Date(2024, 0, 1, 12, 0, 0).getTime(),
    new Date(2024, 0, 1, 13, 0, 0).getTime(),
  ]);
});

test("推算每天凌晨三点", () => {
  const from = new Date(2024, 0, 1, 10, 30, 0).getTime();
  const result = nextRuns("0 3 * * *", { from, count: 2 });
  assert.deepEqual(result.runs, [
    new Date(2024, 0, 2, 3, 0, 0).getTime(),
    new Date(2024, 0, 3, 3, 0, 0).getTime(),
  ]);
});

test("月末兜底：31 号只会在有 31 号的月份触发", () => {
  const from = new Date(2024, 0, 31, 0, 0, 0).getTime();
  const result = nextRuns("0 0 31 * *", { from, count: 2 });
  assert.equal(result.ok, true);
  const dates = result.runs.map((ms) => new Date(ms));
  assert.equal(dates[0].getMonth(), 2); // 跳出 2 月，落在 3 月 31 日
  assert.equal(dates[0].getDate(), 31);
  assert.equal(dates[1].getMonth(), 4);
});

test("描述文本", () => {
  assert.equal(describeCron("0 3 * * *").description, "每天 03:00 触发");
  assert.equal(describeCron("* * * * *").description, "每分钟触发");
  assert.equal(describeCron("30 * * * *").description, "每小时第 30 分钟触发");
  assert.equal(describeCron("0 9 * * 1").description, "每周周一 09:00 触发");
  assert.equal(describeCron("*/5 * * * *").description, null);
});

test("字段展开给界面用", () => {
  const rows = explainFields("0 0 1 1 *").rows;
  assert.equal(rows.length, 5);
  assert.deepEqual(rows[2].values, [1]);
});
