import test from "node:test";
import assert from "node:assert/strict";
import {
  htmlEscape,
  htmlUnescape,
  unicodeEscape,
  unicodeUnescape,
  hexEncode,
  hexDecode,
  decodeWithCharset,
  isCharsetSupported,
} from "../src/tools/encode.js";
import {
  textStats,
  sortLines,
  dedupeLines,
  removeEmptyLines,
  trimLines,
  reverseLines,
} from "../src/tools/text.js";
import { generatePassword } from "../src/tools/password.js";

test("HTML 实体转义与还原", () => {
  const escaped = htmlEscape('<a href="x">Tom & Jerry</a>');
  assert.equal(escaped, "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&lt;/a&gt;");
  assert.equal(htmlUnescape(escaped), '<a href="x">Tom & Jerry</a>');
  assert.equal(htmlUnescape("&#65;&#x4F60;&nbsp;&copy;"), "A你\u00a0\u00a9");
  assert.equal(htmlUnescape("&unknown;"), "&unknown;");
});

test("Unicode 转义与还原", () => {
  assert.equal(unicodeEscape("你a"), "\\u4F60a");
  assert.equal(unicodeEscape("🐟"), "\\u{1F600}".replace("1F600", "1F41F"));
  for (const text of ["中文 abc", "🐟🎣", "tab\there"]) {
    assert.equal(unicodeUnescape(unicodeEscape(text)), text);
  }
  assert.equal(unicodeUnescape("\\x41\\x42"), "AB");
});

test("十六进制编解码", () => {
  assert.equal(hexEncode("hi"), "68 69");
  assert.equal(hexEncode("hi", { separator: "", upper: true }), "6869");
  assert.equal(hexDecode("68 69").text, "hi");
  assert.equal(hexDecode("0x68,0x69").text, "hi");
  assert.equal(hexDecode(hexEncode("大肥鱼")).text, "大肥鱼");
  assert.match(hexDecode("zz").error, /十六进制/);
  assert.match(hexDecode("").error, /输入为空/);
});

test("乱码修复：GBK 字节被当成 Latin-1", () => {
  if (!isCharsetSupported("gbk")) return;
  const mojibake = String.fromCharCode(0xc4, 0xe3, 0xba, 0xc3);
  const fixed = decodeWithCharset(mojibake, "gbk");
  assert.equal(fixed.ok, true);
  assert.equal(fixed.text, "你好");
  assert.equal(decodeWithCharset("abc", "bogus-charset").ok, false);
});

test("文本统计", () => {
  const stats = textStats("你好 world\n\n第二行");
  assert.equal(stats.chars, "你好 world\n\n第二行".length);
  assert.equal(stats.lines, 3);
  assert.equal(stats.nonEmptyLines, 2);
  assert.equal(stats.cjkChars, 5);
  assert.equal(stats.words, 5 + 1);
  assert.equal(stats.bytes, Buffer.byteLength("你好 world\n\n第二行", "utf8"));
});

test("排序：字典序 / 数字 / 反向", () => {
  assert.equal(sortLines("b\na\nc"), "a\nb\nc");
  assert.equal(sortLines("10\n9\n2"), "2\n9\n10");
  assert.equal(sortLines("10\n9\n2", { numeric: true }), "2\n9\n10");
  assert.equal(sortLines("a\nb", { reverse: true }), "b\na");
});

test("去重、去空行、去首尾空格、反转", () => {
  assert.deepEqual(dedupeLines("a\nb\na"), { text: "a\nb", removed: 1, kept: 2 });
  assert.deepEqual(removeEmptyLines("a\n\n \nb"), { text: "a\nb", removed: 2 });
  assert.equal(trimLines("  a  \n\tb\t"), "a\nb");
  assert.equal(reverseLines("a\nb\nc"), "c\nb\na");
});

test("密码生成：长度、必含各类字符、可选符号", () => {
  const result = generatePassword({ length: 20, symbols: true });
  assert.equal(result.ok, true);
  assert.equal(result.password.length, 20);
  assert.match(result.password, /[a-z]/);
  assert.match(result.password, /[A-Z]/);
  assert.match(result.password, /[0-9]/);
  assert.match(result.password, /[!@#$%^&*()\-_=+\[\]{};:,.?/]/);
  assert.ok(result.entropyBits > 100);
});

test("密码生成：不选任何字符类型报错，多次生成不重复", () => {
  assert.equal(generatePassword({ lower: false, upper: false, digits: false }).ok, false);
  const a = generatePassword({ length: 32 }).password;
  const b = generatePassword({ length: 32 }).password;
  assert.notEqual(a, b);
});
