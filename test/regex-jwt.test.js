import test from "node:test";
import assert from "node:assert/strict";
import { testRegex, replaceRegex } from "../src/tools/regex.js";
import { decodeJwt, looksLikeJwt } from "../src/tools/jwt.js";

const b64url = (value) => Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

test("列出全部匹配与分组", () => {
  const result = testRegex("(a+)(b)", "g", "aab ab aaab");
  assert.equal(result.ok, true);
  assert.equal(result.matches.length, 3);
  assert.deepEqual(result.matches[0], { index: 0, end: 3, value: "aab", groups: ["aa", "b"], named: null });
  assert.equal(result.matches[2].index, 7);
});

test("没有写 g 也自动补上", () => {
  const result = testRegex("o", "", "foo boo");
  assert.equal(result.matches.length, 4);
  assert.ok(result.flags.includes("g"));
});

test("命名分组会带出来", () => {
  const result = testRegex("(?<year>\\d{4})-(?<month>\\d{2})", "g", "2024-05");
  assert.deepEqual(result.matches[0].named, { year: "2024", month: "05" });
});

test("非法正则与非法标志都返回错误对象", () => {
  assert.equal(testRegex("(", "g", "x").ok, false);
  assert.match(testRegex("a", "q", "x").error, /标志/);
  assert.match(testRegex("", "g", "x").error, /为空/);
});

test("零宽匹配不会死循环", () => {
  const result = testRegex("a*", "g", "baa");
  assert.equal(result.ok, true);
  assert.ok(result.matches.length > 0);
  assert.ok(result.matches.length < 10);
});

test("替换预览", () => {
  assert.equal(replaceRegex("(\\d+)", "g", "a1b22", "#$1").output, "a#1b#22");
  assert.equal(replaceRegex("x", "g", "xxx", "y").output, "yyy");
});

test("JWT 解析 header / payload / 有效期", () => {
  const now = 1700000000000;
  const token = [b64url({ alg: "HS256", typ: "JWT" }), b64url({ sub: "42", iss: "demo", iat: now / 1000, exp: now / 1000 + 600 })].join(".") + ".sig";
  const result = decodeJwt(token, { now });
  assert.equal(result.ok, true);
  assert.equal(result.header.alg, "HS256");
  assert.equal(result.payload.sub, "42");
  assert.equal(result.claims.exp, now / 1000 + 600);
  assert.equal(result.lifetime[0].status, "valid");
  assert.equal(result.warnings.length, 0);
});

test("过期令牌给出过期提示", () => {
  const now = 1700000000000;
  const token = [b64url({ alg: "HS256" }), b64url({ exp: now / 1000 - 3600 })].join(".") + ".sig";
  const result = decodeJwt(token, { now });
  assert.equal(result.lifetime[0].status, "expired");
  assert.ok(result.warnings.some((item) => item.includes("过期")));
});

test("alg=none 与只有两段都会提示", () => {
  const token = [b64url({ alg: "none" }), b64url({ a: 1 })].join(".");
  const result = decodeJwt(token);
  assert.ok(result.warnings.some((item) => item.includes("none")));
  assert.ok(result.warnings.some((item) => item.includes("2 段")));
  assert.equal(result.parts, 2);
});

test("去掉 Bearer 前缀也能解析", () => {
  const token = [b64url({ alg: "RS256" }), b64url({ a: 1 }), "sig"].join(".");
  assert.equal(decodeJwt(`Bearer ${token}`).ok, true);
});

test("坏令牌返回错误", () => {
  assert.equal(decodeJwt("").ok, false);
  assert.equal(decodeJwt("a.b.c.d").ok, false);
  const badPayload = b64url({ alg: "HS256" }) + ".!!!.sig";
  assert.equal(decodeJwt(badPayload).ok, false);
  assert.equal(looksLikeJwt("aaa.bbb.ccc"), true);
  assert.equal(looksLikeJwt("nope"), false);
});
