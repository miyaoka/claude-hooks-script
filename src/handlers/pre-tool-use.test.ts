import { describe, it, expect } from "bun:test";
import { handlePreToolUse, type PreToolUseConfig } from "./pre-tool-use";
import type { PreToolUseInput } from "../types";

describe("handlePreToolUse - 優先順位とマッチング", () => {
  describe("デフォルト設定と特定条件の優先順位", () => {
    it("argsなしのデフォルト設定が適用される", async () => {
      const config: PreToolUseConfig = {
        preToolUse: [
          {
            matcher: "Bash",
            command: "cat",
            decision: "approve",
            reason: "catコマンドは基本的に許可"
          }
        ]
      };

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: "cat file.txt"
        }
      };

      const response = await handlePreToolUse(input, config);
      
      expect(response).toEqual({
        decision: "approve",
        reason: "catコマンドは基本的に許可"
      });
    });

    it("argsありの設定がデフォルト設定より優先される", async () => {
      const config: PreToolUseConfig = {
        preToolUse: [
          {
            matcher: "Bash",
            command: "cat",
            decision: "approve",
            reason: "catコマンドは基本的に許可"
          },
          {
            matcher: "Bash",
            command: "cat",
            args: "password",
            decision: "block",
            reason: "パスワードファイルは禁止"
          }
        ]
      };

      // パスワードファイルの場合
      const inputPassword: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: "cat password.txt"
        }
      };

      const responsePassword = await handlePreToolUse(inputPassword, config);
      expect(responsePassword).toEqual({
        decision: "block",
        reason: "パスワードファイルは禁止"
      });

      // 通常ファイルの場合
      const inputNormal: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: "cat normal.txt"
        }
      };

      const responseNormal = await handlePreToolUse(inputNormal, config);
      expect(responseNormal).toEqual({
        decision: "approve",
        reason: "catコマンドは基本的に許可"
      });
    });
  });

  describe("配列での上書きルール", () => {
    it("argsなしの同じcommandは後者で上書きされる", async () => {
      const config: PreToolUseConfig = {
        preToolUse: [
          {
            matcher: "Bash",
            command: "rm",
            decision: "approve",
            reason: "最初の設定"
          },
          {
            matcher: "Bash",
            command: "rm",
            decision: "block",
            reason: "後の設定で上書き"
          }
        ]
      };

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: "rm file.txt"
        }
      };

      const response = await handlePreToolUse(input, config);
      expect(response).toEqual({
        decision: "block",
        reason: "後の設定で上書き"
      });
    });

    it("argsありはcommandとargs両方が同一の場合のみ上書きされる", async () => {
      const config: PreToolUseConfig = {
        preToolUse: [
          {
            matcher: "Bash",
            command: "rm",
            args: "\\.log$",
            decision: "approve",
            reason: "ログファイル削除は許可"
          },
          {
            matcher: "Bash",
            command: "rm",
            args: "\\.tmp$",
            decision: "approve",
            reason: "一時ファイル削除は許可"
          },
          {
            matcher: "Bash",
            command: "rm",
            args: "\\.log$",
            decision: "block",
            reason: "ログファイル削除を禁止に変更"
          }
        ]
      };

      // .logファイルの場合（上書きされる）
      const inputLog: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: "rm test.log"
        }
      };

      const responseLog = await handlePreToolUse(inputLog, config);
      expect(responseLog).toEqual({
        decision: "block",
        reason: "ログファイル削除を禁止に変更"
      });

      // .tmpファイルの場合（独立して存在）
      const inputTmp: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: "rm test.tmp"
        }
      };

      const responseTmp = await handlePreToolUse(inputTmp, config);
      expect(responseTmp).toEqual({
        decision: "approve",
        reason: "一時ファイル削除は許可"
      });
    });
  });

  describe("複数マッチ時のdecision優先順位", () => {
    it("block > approveの優先順位で安全側に倒される", async () => {
      const config: PreToolUseConfig = {
        preToolUse: [
          {
            matcher: "Bash",
            command: "rm",
            args: "\\.log$",
            decision: "approve",
            reason: "ログファイルの削除は許可"
          },
          {
            matcher: "Bash",
            command: "rm",
            args: "production",
            decision: "block",
            reason: "productionを含むパスは禁止"
          }
        ]
      };

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: "rm production.log"
        }
      };

      const response = await handlePreToolUse(input, config);
      expect(response).toEqual({
        decision: "block",
        reason: "productionを含むパスは禁止"
      });
    });

    it("block > undefined > approveの優先順位", async () => {
      const config: PreToolUseConfig = {
        preToolUse: [
          {
            matcher: "Bash",
            command: "cat",
            args: "\\.conf$",
            decision: "approve",
            reason: "設定ファイルは許可"
          },
          {
            matcher: "Bash",
            command: "cat",
            args: "secret",
            decision: undefined as any, // テスト用にundefinedを設定
            reason: "秘密情報は要確認"
          }
        ]
      };

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: "cat secret.conf"
        }
      };

      const response = await handlePreToolUse(input, config);
      expect(response).toEqual({
        reason: "秘密情報は要確認"
      });
    });
  });

  describe("マッチしない場合", () => {
    it("ツール名がマッチしない場合は空のオブジェクトを返す", async () => {
      const config: PreToolUseConfig = {
        preToolUse: [
          {
            matcher: "Bash",
            command: "rm",
            decision: "block",
            reason: "rmコマンドは禁止"
          }
        ]
      };

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        hook_event_name: "PreToolUse",
        tool_name: "Read",
        tool_input: {
          file_path: "/home/user/file.txt"
        }
      };

      const response = await handlePreToolUse(input, config);
      expect(response).toEqual({});
    });

    it("コマンドがマッチしない場合は空のオブジェクトを返す", async () => {
      const config: PreToolUseConfig = {
        preToolUse: [
          {
            matcher: "Bash",
            command: "rm",
            decision: "block",
            reason: "rmコマンドは禁止"
          }
        ]
      };

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: "ls -la"
        }
      };

      const response = await handlePreToolUse(input, config);
      expect(response).toEqual({});
    });
  });

  describe("Bash以外のツール", () => {
    it("Writeツールでargsパターンマッチ", async () => {
      const config: PreToolUseConfig = {
        preToolUse: [
          {
            matcher: "Write",
            args: "/etc/",
            decision: "block",
            reason: "システムファイルへの書き込みは禁止"
          }
        ]
      };

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/etc/passwd",
          content: "malicious content"
        }
      };

      const response = await handlePreToolUse(input, config);
      expect(response).toEqual({
        decision: "block",
        reason: "システムファイルへの書き込みは禁止"
      });
    });

    it("Edit|Write|MultiEditの正規表現マッチャー", async () => {
      const config: PreToolUseConfig = {
        preToolUse: [
          {
            matcher: "Edit|Write|MultiEdit",
            args: "\\.env$",
            decision: "block",
            reason: "環境変数ファイルの編集は禁止"
          }
        ]
      };

      // Editツール
      const inputEdit: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        hook_event_name: "PreToolUse",
        tool_name: "Edit",
        tool_input: {
          file_path: "/home/user/.env",
          old_string: "SECRET=old",
          new_string: "SECRET=new"
        }
      };

      const responseEdit = await handlePreToolUse(inputEdit, config);
      expect(responseEdit).toEqual({
        decision: "block",
        reason: "環境変数ファイルの編集は禁止"
      });

      // MultiEditツール
      const inputMultiEdit: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        hook_event_name: "PreToolUse",
        tool_name: "MultiEdit",
        tool_input: {
          file_path: "/app/.env",
          edits: []
        }
      };

      const responseMultiEdit = await handlePreToolUse(inputMultiEdit, config);
      expect(responseMultiEdit).toEqual({
        decision: "block",
        reason: "環境変数ファイルの編集は禁止"
      });
    });

    it("すべてのツールにマッチする空のmatcher", async () => {
      const config: PreToolUseConfig = {
        preToolUse: [
          {
            // matcherを省略
            args: "secret",
            decision: "block",
            reason: "secretを含むパスは禁止"
          }
        ]
      };

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        hook_event_name: "PreToolUse",
        tool_name: "Read",
        tool_input: {
          file_path: "/home/user/secret.txt"
        }
      };

      const response = await handlePreToolUse(input, config);
      expect(response).toEqual({
        decision: "block",
        reason: "secretを含むパスは禁止"
      });
    });

    it("Bash以外のツールでcommandフィールドは無視される", async () => {
      const config: PreToolUseConfig = {
        preToolUse: [
          {
            matcher: "Write",
            command: "rm", // Bash以外では無視される
            args: "/tmp/",
            decision: "approve",
            reason: "一時ディレクトリへの書き込みは許可"
          }
        ]
      };

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/tmp/test.txt",
          content: "test"
        }
      };

      const response = await handlePreToolUse(input, config);
      expect(response).toEqual({
        decision: "approve",
        reason: "一時ディレクトリへの書き込みは許可"
      });
    });
  });
});