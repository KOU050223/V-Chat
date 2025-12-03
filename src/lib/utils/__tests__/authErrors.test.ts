import { getAuthErrorMessage } from "@/lib/utils/authErrors";

describe("getAuthErrorMessage", () => {
  const GENERIC_MESSAGE =
    "認証エラーが発生しました。しばらくしてから再度お試しください。";
  // 既知のエラーコードのテスト
  describe("既知のエラーコード", () => {
    it("auth/invalid-credential のエラーメッセージを返す", () => {
      const error = "Firebase: Error (auth/invalid-credential).";
      const result = getAuthErrorMessage(error);
      expect(result).toBe("メールアドレスまたはパスワードが正しくありません");
    });

    it("auth/user-not-found のエラーメッセージを返す", () => {
      const error = "Firebase: Error (auth/user-not-found).";
      const result = getAuthErrorMessage(error);
      expect(result).toBe("ユーザーが見つかりません");
    });

    it("auth/wrong-password のエラーメッセージを返す", () => {
      const error = "Firebase: Error (auth/wrong-password).";
      const result = getAuthErrorMessage(error);
      expect(result).toBe("パスワードが間違っています");
    });

    it("auth/email-already-in-use のエラーメッセージを返す", () => {
      const error = "Firebase: Error (auth/email-already-in-use).";
      const result = getAuthErrorMessage(error);
      expect(result).toBe("このメールアドレスは既に使用されています");
    });

    it("auth/weak-password のエラーメッセージを返す", () => {
      const error = "Firebase: Error (auth/weak-password).";
      const result = getAuthErrorMessage(error);
      expect(result).toBe("パスワードは6文字以上で入力してください");
    });

    it("auth/invalid-email のエラーメッセージを返す", () => {
      const error = "Firebase: Error (auth/invalid-email).";
      const result = getAuthErrorMessage(error);
      expect(result).toBe("メールアドレスの形式が正しくありません");
    });

    it("auth/popup-closed-by-user のエラーメッセージを返す", () => {
      const error = "Firebase: Error (auth/popup-closed-by-user).";
      const result = getAuthErrorMessage(error);
      expect(result).toBe("ログインがキャンセルされました");
    });

    it("auth/network-request-failed のエラーメッセージを返す", () => {
      const error = "Firebase: Error (auth/network-request-failed).";
      const result = getAuthErrorMessage(error);
      expect(result).toBe("ネットワークエラーが発生しました");
    });

    it("auth/too-many-requests のエラーメッセージを返す", () => {
      const error = "Firebase: Error (auth/too-many-requests).";
      const result = getAuthErrorMessage(error);
      expect(result).toBe(
        "リクエストが多すぎます。しばらくしてから再度お試しください"
      );
    });

    it("auth/user-disabled のエラーメッセージを返す", () => {
      const error = "Firebase: Error (auth/user-disabled).";
      const result = getAuthErrorMessage(error);
      expect(result).toBe("このアカウントは無効化されています");
    });

    it("auth/operation-not-allowed のエラーメッセージを返す", () => {
      const error = "Firebase: Error (auth/operation-not-allowed).";
      const result = getAuthErrorMessage(error);
      expect(result).toBe("この操作は許可されていません");
    });
  });

  // 未知のエラーコードのテスト
  describe("未知のエラーコード", () => {
    it("未知のエラーコードの場合、汎用メッセージを返す", () => {
      const error = "Firebase: Unknown error occurred.";
      const result = getAuthErrorMessage(error);
      expect(result).toBe(GENERIC_MESSAGE);
    });

    it("空文字列の場合、汎用メッセージを返す", () => {
      const error = "";
      const result = getAuthErrorMessage(error);
      expect(result).toBe(GENERIC_MESSAGE);
    });

    it("エラーコードが含まれていないメッセージの場合、汎用メッセージを返す", () => {
      const error = "Some random error message";
      const result = getAuthErrorMessage(error);
      expect(result).toBe(GENERIC_MESSAGE);
    });
  });

  // エッジケースのテスト
  describe("エッジケース", () => {
    it("エラーコードが途中に含まれている場合も正しく認識する", () => {
      const error =
        "Error occurred: auth/invalid-credential - please check credentials";
      const result = getAuthErrorMessage(error);
      expect(result).toBe("メールアドレスまたはパスワードが正しくありません");
    });

    it("複数のエラーコードが含まれている場合、最初にマッチしたものを返す", () => {
      const error = "auth/invalid-credential and auth/user-not-found";
      const result = getAuthErrorMessage(error);
      // errorMapの順序によって最初にマッチするものが返される
      expect(result).toBe("メールアドレスまたはパスワードが正しくありません");
    });
  });
  describe("開発環境でのログ出力", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    afterEach(() => {
      consoleErrorSpy.mockClear();
      vi.unstubAllEnvs();
    });

    afterAll(() => {
      consoleErrorSpy.mockRestore();
    });

    it("開発環境では未知のエラーがconsole.errorに出力される", () => {
      vi.stubEnv("NODE_ENV", "development");
      const error = "Unknown error";
      getAuthErrorMessage(error);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Unhandled auth error:",
        error
      );
    });

    it("本番環境では未知のエラーがconsole.errorに出力されない", () => {
      vi.stubEnv("NODE_ENV", "production");
      const error = "Unknown error";
      getAuthErrorMessage(error);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });
});
