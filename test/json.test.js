import test from "node:test";
import assert from "node:assert/strict";
import { formatJson, validateJson, normalizeIndent, utf8ByteLength } from "../src/tools/json.js";

test("格式化成 2 空格缩进", () => {
  const result = formatJson('{"a":1,"b":[1,2]}');
  assert.equal(result.ok, true);
  assert.equal(result.output, '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}');
});

test("压缩模式去掉所有空白", () => {
  const result = formatJson('{\n  "a": 1,\n  "b": [1, 2]\n}', { mode: "minify" });
  assert.equal(result.output, '{"a":1,"b":[1,2]}');
});

test("sortKeys 递归排序", () => {
  const result = formatJson('{"b":1,"a":{"z":1,"y":2}}', { mode: "minify", sortKeys: true });
  assert.equal(result.output, '{"a":{"y":2,"z":1},"b":1}');
});

test("非法 JSON 报出准确的行号与列号", () => {
  const source = '{\n  "a": 1,\n  "b": }\n}';
  const result = formatJson(source);
  assert.equal(result.ok, false);
  assert.equal(result.error.line, 3);
  assert.ok(result.error.column >= 1);
  assert.ok(result.error.excerpt.includes('"b"'));
});

test("空输入给出明确错误", () => {
  const result = formatJson("   ");
  assert.equal(result.ok, false);
  assert.equal(result.error.message, "输入为空");
});

test("统计字节数、键数量与层数", () => {
  const result = formatJson('{"a":{"b":1},"c":[{"d":2}]}', { mode: "minify" });
  assert.equal(result.stats.keys, 4);
  assert.equal(result.stats.depth, 3);
  assert.equal(result.stats.bytes, Buffer.byteLength(result.output, "utf8"));
});

test("中文按真实字节数计算", () => {
  assert.equal(utf8ByteLength("你好"), 6);
  assert.equal(utf8ByteLength("abc"), 3);
  assert.equal(utf8ByteLength("🐟"), 4);
});

test("缩进参数归一", () => {
  assert.equal(normalizeIndent(4), "    ");
  assert.equal(normalizeIndent("tab"), "\t");
  assert.equal(normalizeIndent(0), "  ");
});

test("validateJson 不返回输出但能判断合法", () => {
  assert.deepEqual(validateJson('{"a":1}'), { ok: true, error: null });
  assert.equal(validateJson("{oops}").ok, false);
});
