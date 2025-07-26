import { describe, expect, it } from "bun:test";
import { type Result, tryCatch } from "./result";

describe("tryCatch", () => {
  describe("成功ケース", () => {
    it("正常な値を返す関数をラップできる", () => {
      const result = tryCatch(() => 42);
      expect(result.value).toBe(42);
      expect(result.error).toBeUndefined();
    });

    it("文字列を返す関数をラップできる", () => {
      const result = tryCatch(() => "hello");
      expect(result.value).toBe("hello");
      expect(result.error).toBeUndefined();
    });

    it("オブジェクトを返す関数をラップできる", () => {
      const obj = { name: "test", value: 123 };
      const result = tryCatch(() => obj);
      expect(result.value).toBe(obj);
      expect(result.error).toBeUndefined();
    });

    it("nullを返す関数をラップできる", () => {
      const result = tryCatch(() => null);
      expect(result.value).toBeNull();
      expect(result.error).toBeUndefined();
    });

    it("undefinedを返す関数をラップできる", () => {
      const result = tryCatch(() => undefined);
      expect(result.value).toBeUndefined();
      expect("value" in result).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe("エラーケース", () => {
    it("例外をキャッチしてエラーとして返す", () => {
      const error = new Error("Something went wrong");
      const result = tryCatch(() => {
        throw error;
      });
      expect(result.value).toBeUndefined();
      expect(result.error).toBe(error);
    });

    it("文字列の例外もキャッチできる", () => {
      const result = tryCatch<never, string>(() => {
        throw "String error";
      });
      expect(result.value).toBeUndefined();
      expect(result.error).toEqual("String error");
    });

    it("オブジェクトの例外もキャッチできる", () => {
      const errorObj = { code: "ERR001", message: "Custom error" };
      const result = tryCatch<never, typeof errorObj>(() => {
        throw errorObj;
      });
      expect(result.value).toBeUndefined();
      expect(result.error).toEqual(errorObj);
    });
  });

  describe("型の使用例", () => {
    it("Result型で成功と失敗を区別できる", () => {
      function processData(data: string): Result<number> {
        return tryCatch(() => {
          const num = Number.parseInt(data);
          if (Number.isNaN(num)) {
            throw new Error("Invalid number");
          }
          return num;
        });
      }

      const success = processData("123");
      expect(success.value).toBe(123);
      expect(success.error).toBeUndefined();

      const failure = processData("abc");
      expect(failure.value).toBeUndefined();
      expect(failure.error).toBeInstanceOf(Error);
      expect(failure.error?.message).toBe("Invalid number");
    });

    it("カスタムエラー型を使用できる", () => {
      class CustomError extends Error {
        constructor(
          public code: number,
          message: string,
        ) {
          super(message);
        }
      }

      function riskyOperation(): Result<string, CustomError> {
        return tryCatch<string, CustomError>(() => {
          throw new CustomError(404, "Not found");
        });
      }

      const result = riskyOperation();
      expect(result.value).toBeUndefined();
      expect(result.error).toBeInstanceOf(CustomError);
      if (result.error) {
        expect(result.error.code).toBe(404);
        expect(result.error.message).toBe("Not found");
      }
    });
  });

  describe("実用的なシナリオ", () => {
    it("JSON.parseのエラーをハンドリングできる", () => {
      const validJson = '{"name": "test"}';
      const invalidJson = "{invalid json}";

      const successResult = tryCatch(() => JSON.parse(validJson));
      expect(successResult.value).toEqual({ name: "test" });
      expect(successResult.error).toBeUndefined();

      const errorResult = tryCatch(() => JSON.parse(invalidJson));
      expect(errorResult.value).toBeUndefined();
      expect(errorResult.error).toBeInstanceOf(SyntaxError);
    });

    it("非同期関数の同期部分のエラーをキャッチできる", () => {
      const result = tryCatch(() => {
        // 同期的にエラーを投げる
        throw new Error("Sync error in async context");
        // 注：非同期のエラーはtryCatchではキャッチできない
      });

      expect(result.value).toBeUndefined();
      expect(result.error).toBeInstanceOf(Error);
    });

    it("ネストしたtryCatchが正しく動作する", () => {
      const result = tryCatch(() => {
        const innerResult = tryCatch(() => {
          throw new Error("Inner error");
        });

        if (innerResult.error) {
          return `Handled: ${innerResult.error.message}`;
        }
        return innerResult.value;
      });

      expect(result.value).toBe("Handled: Inner error");
      expect(result.error).toBeUndefined();
    });
  });
});
