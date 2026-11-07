import test from "node:test";
import assert from "node:assert/strict";
import { encodeBase64, decodeBase64, looksLikeBase64 } from "../src/tools/base64.js";
import { urlEncode, urlDecode } from "../src/tools/url.js";

test("ASCII 编解码", () => {
  assert.equal(encodeBase64("hello"), "aGVsbG8=");
  assert.equal(decodeBase64("aGVsbG8=").text, "hello");
});

test("中文与 emoji 往返一致", () => {
  for (const text of ["你好，世界", "大肥鱼 🐟 吃白饭", "line1\nline2"]) {
    const decoded = decodeBase64(encodeBase64(text));
    assert.equal(decoded.ok, true);
    assert.equal(decoded.text, text);
  }
});

test("Base64URL 编码与自动识别", () => {
  const encoded = encodeBase64("a?b>c~d", { urlSafe: true });
  assert.ok(!encoded.includes("+") && !encoded.includes("/"));
  const decoded = decodeBase64(encoded);
  assert.equal(decoded.ok, true);
  assert.equal(decoded.urlSafe, true);
  assert.equal(decoded.text, "a?b>c~d");
});

test("解码容错：空白、缺省填充", () => {
  assert.equal(decodeBase64(" aGVs bG8 ").text, "hello");
  assert.equal(decodeBase64("aGVsbG8").text, "hello");
});

test("非法输入返回明确错误", () => {
  assert.match(decodeBase64("!!!!").error, /非法字符/);
  assert.match(decodeBase64("abcde").error, /长度/);
  assert.match(decodeBase64("ab=cde").error, /末尾/);
  assert.match(decodeBase64("").error, /输入为空/);
});

test("二进制内容不会抛异常，只标记 lossy", () => {
  const raw = Buffer.from([0xff, 0xfe, 0xfd]).toString("base64");
  const decoded = decodeBase64(raw);
  assert.equal(decoded.ok, true);
  assert.equal(decoded.lossy, true);
});

test("looksLikeBase64 判断", () => {
  assert.equal(looksLikeBase64("aGVsbG8="), true);
  assert.equal(looksLikeBase64("hello!!"), false);
  assert.equal(looksLikeBase64("a"), false);
  assert.equal(looksLikeBase64("aGVsbG8"), true);
});

test("URL component 编码与整段编码的区别", () => {
  assert.equal(urlEncode("a b&c/安全").output, "a%20b%26c%2F%E5%AE%89%E5%85%A8");
  assert.equal(urlEncode("https://x.com/a?b=1&c=2", { mode: "whole" }).output, "https://x.com/a?b=1&c=2");
});

test("URL 解码：正常、加号当空格、坏字节可恢复", () => {
  assert.equal(urlDecode("%E4%BD%A0%E5%A5%BD").output, "你好");
  assert.equal(urlDecode("a+b", { plusAsSpace: true }).output, "a b");
  const broken = urlDecode("%E4%BD%A0%E5");
  assert.equal(broken.ok, true);
  assert.equal(broken.recovered, true);
  assert.ok(broken.output.startsWith("你"));
});
