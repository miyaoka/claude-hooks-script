import { describe, expect, it } from "bun:test";
import { matchPattern } from "./matcher";

describe("matchPattern", () => {
  it("正規表現パターンでマッチする（大文字小文字を無視）", () => {
    expect(matchPattern("^npm", "npm install")).toBe(true);
    expect(matchPattern("^NPM", "npm install")).toBe(true);
    expect(matchPattern("^npm", "NPM INSTALL")).toBe(true);
    expect(matchPattern("^npm", "pnpm install")).toBe(false);
    expect(matchPattern("test.*\\.ts$", "src/app.test.ts")).toBe(true);
    expect(matchPattern("TEST.*\\.TS$", "src/app.test.ts")).toBe(true);
    expect(matchPattern("test.*\\.ts$", "src/app.js")).toBe(false);
  });

  it("無効な正規表現は文字列として部分一致する（大文字小文字を無視）", () => {
    expect(matchPattern("[invalid", "test [invalid pattern")).toBe(true);
    expect(matchPattern("[INVALID", "test [invalid pattern")).toBe(true);
    expect(matchPattern("[invalid", "test [INVALID pattern")).toBe(true);
    expect(matchPattern("[invalid", "test pattern")).toBe(false);
  });

  it("通常の文字列として部分一致する（大文字小文字を無視）", () => {
    expect(matchPattern("install", "npm install")).toBe(true);
    expect(matchPattern("INSTALL", "npm install")).toBe(true);
    expect(matchPattern("install", "NPM INSTALL")).toBe(true);
    expect(matchPattern("install", "npm build")).toBe(false);
  });

  it("特殊文字を含む文字列でも動作する", () => {
    expect(matchPattern(".*", "anything")).toBe(true); // 正規表現として
    expect(matchPattern("file.txt", "open file.txt")).toBe(true); // 文字列として
  });
});
