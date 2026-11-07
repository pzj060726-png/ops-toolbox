import test from "node:test";
import assert from "node:assert/strict";
import { diffLines } from "../src/tools/diff.js";

test("完全相同的文本", () => {
  const result = diffLines("a\nb\nc", "a\nb\nc");
  assert.equal(result.identical, true);
  assert.deepEqual(result.stats, { added: 0, removed: 0, unchanged: 3 });
});

test("新增一行", () => {
  const result = diffLines("a\nb", "a\nx\nb");
  assert.deepEqual(result.ops.map((op) => op.type), ["equal", "add", "equal"]);
  assert.equal(result.stats.added, 1);
  assert.equal(result.ops[1].text, "x");
});

test("删除一行", () => {
  const result = diffLines("a\nb\nc", "a\nc");
  assert.deepEqual(result.ops.map((op) => op.type), ["equal", "del", "equal"]);
  assert.equal(result.stats.removed, 1);
});

test("替换一行会先删后加，且行号正确", () => {
  const result = diffLines("one\ntwo\nthree", "one\nTWO\nthree");
  assert.deepEqual(result.ops.map((op) => op.type), ["equal", "del", "add", "equal"]);
  assert.deepEqual(result.ops[1].oldLine, 2);
  assert.deepEqual(result.ops[2].newLine, 2);
  assert.equal(result.ops[3].oldLine, 3);
  assert.equal(result.ops[3].newLine, 3);
});

test("空文本与有内容对比", () => {
  assert.equal(diffLines("", "a\nb").stats.added, 2);
  assert.equal(diffLines("a\nb", "").stats.removed, 2);
  assert.equal(diffLines("", "").identical, true);
});

test("末尾空行不会被误判成差异", () => {
  assert.equal(diffLines("a\nb\n", "a\nb").identical, true);
  assert.equal(diffLines("a\r\nb", "a\nb").identical, true);
});

test("过大输入给出可读错误而不是卡死", () => {
  const big = Array.from({ length: 2000 }, (_, index) => "line " + index).join("\n");
  const other = Array.from({ length: 2000 }, (_, index) => "row " + index).join("\n");
  const result = diffLines(big, other);
  assert.equal(result.ok, false);
  assert.match(result.error, /太大/);
});
