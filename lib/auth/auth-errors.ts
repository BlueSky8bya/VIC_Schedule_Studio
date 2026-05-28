// OAuth 실패를 URL에 날 것의 기술 메시지로 흘리지 않는다. 콜백은 안정적인 짧은 코드만
// 남기고(?error=canceled 등), 로그인 화면이 그 코드를 사람이 읽을 친절한 문구로 바꾼다.

export type AuthErrorCode = "canceled" | "exchange" | "unknown";

export function normalizeAuthErrorCode(value: string | null | undefined): AuthErrorCode {
  switch (value) {
    case "canceled":
    case "exchange":
      return value;
    default:
      return "unknown";
  }
}

// OAuth 제공자가 콜백에 붙여 보내는 error 파라미터(access_denied 등)를 우리 코드로 매핑.
export function providerErrorToCode(providerError: string | null | undefined): AuthErrorCode {
  if (!providerError) {
    return "unknown";
  }
  // 사용자가 동의 화면에서 취소하면 access_denied가 온다.
  if (providerError === "access_denied") {
    return "canceled";
  }
  return "unknown";
}

export function friendlyAuthMessage(code: AuthErrorCode): string {
  switch (code) {
    case "canceled":
      return "구글 로그인을 취소했어요. 다시 로그인하려면 아래 버튼을 눌러 주세요.";
    case "exchange":
      return "로그인 처리 중 문제가 생겼어요. 네트워크를 확인하고 잠시 후 다시 시도해 주세요.";
    default:
      return "로그인에 문제가 생겼어요. 아래 버튼으로 다시 시도해 주세요.";
  }
}
