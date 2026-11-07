import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeCidr,
  parseIPv4,
  ipv4ToString,
  prefixToMask,
  maskToPrefix,
  splitSubnets,
} from "../src/tools/cidr.js";

test("IPv4 解析与还原", () => {
  assert.equal(parseIPv4("255.255.255.255"), 4294967295);
  assert.equal(parseIPv4("0.0.0.0"), 0);
  assert.equal(parseIPv4("192.168.1.1"), 3232235777);
  assert.equal(ipv4ToString(3232235777), "192.168.1.1");
  assert.equal(parseIPv4("256.1.1.1"), null);
  assert.equal(parseIPv4("1.2.3"), null);
  assert.equal(parseIPv4("1.2.3.4.5"), null);
});

test("/24 子网信息", () => {
  const info = analyzeCidr("192.168.1.10/24");
  assert.equal(info.ok, true);
  assert.equal(info.network, "192.168.1.0");
  assert.equal(info.broadcast, "192.168.1.255");
  assert.equal(info.mask, "255.255.255.0");
  assert.equal(info.wildcard, "0.0.0.255");
  assert.equal(info.firstHost, "192.168.1.1");
  assert.equal(info.lastHost, "192.168.1.254");
  assert.equal(info.hostCount, 254);
  assert.equal(info.totalAddresses, 256);
  assert.equal(info.ipInNetwork, true);
  assert.match(info.special, /私有/);
});

test("不带前缀默认 /32", () => {
  const info = analyzeCidr("10.1.2.3");
  assert.equal(info.prefix, 32);
  assert.equal(info.hostCount, 1);
  assert.equal(info.firstHost, "10.1.2.3");
});

test("/31 与 /32 的可用主机数", () => {
  assert.equal(analyzeCidr("10.0.0.0/31").hostCount, 2);
  assert.equal(analyzeCidr("10.0.0.1/32").hostCount, 1);
});

test("/0 覆盖整个 IPv4 空间", () => {
  const info = analyzeCidr("0.0.0.0/0");
  assert.equal(info.totalAddresses, 4294967296);
  assert.equal(info.mask, "0.0.0.0");
});

test("非法输入返回错误而不是抛异常", () => {
  assert.match(analyzeCidr("").error, /输入为空/);
  assert.match(analyzeCidr("999.1.1.1/24").error, /无效的 IPv4/);
  assert.match(analyzeCidr("10.0.0.1/33").error, /0 到 32/);
  assert.match(analyzeCidr("fd00::1/64").error, /IPv6/);
});

test("掩码与前缀互转", () => {
  assert.equal(prefixToMask(24), 4294967040);
  assert.equal(prefixToMask(0), 0);
  assert.equal(maskToPrefix(4294967040), 24);
  assert.equal(maskToPrefix(0xffffff00), 24);
  assert.equal(maskToPrefix(0xffff00ff), null);
  for (let prefix = 0; prefix <= 32; prefix += 1) {
    assert.equal(maskToPrefix(prefixToMask(prefix)), prefix);
  }
});

test("子网划分", () => {
  const result = splitSubnets("10.0.0.0/24", 26);
  assert.equal(result.ok, true);
  assert.equal(result.count, 4);
  assert.deepEqual(result.rows.map((row) => row.network), ["10.0.0.0", "10.0.0.64", "10.0.0.128", "10.0.0.192"]);
  assert.equal(result.rows[0].firstHost, "10.0.0.1");
  assert.equal(result.rows[0].lastHost, "10.0.0.62");
  assert.equal(result.rows[0].hostCount, 62);
});

test("子网划分的前缀校验", () => {
  assert.equal(splitSubnets("10.0.0.0/24", 16).ok, false);
  assert.match(splitSubnets("10.0.0.0/8", 30).error, /超过/);
});
