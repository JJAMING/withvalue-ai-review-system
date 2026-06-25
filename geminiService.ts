
import { RequestConfig, GenerationResult } from "./types";

const normalizeErrorMessage = (message: string) => {
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("429") ||
    lowerMessage.includes("resource_exhausted") ||
    lowerMessage.includes("quota") ||
    lowerMessage.includes("rate limit")
  ) {
    return "요청이 잠시 많아 답변을 생성하지 못했습니다. 잠시 후 다시 시도해주세요.";
  }

  if (lowerMessage.includes("function_invocation_timeout") || lowerMessage.includes("timed out")) {
    return "이미지 분석 시간이 길어져 답변을 생성하지 못했습니다. 이미지를 다시 첨부하거나 리뷰 텍스트를 함께 입력해주세요.";
  }

  if (message.length > 180 || message.trim().startsWith("{")) {
    return "답변 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }

  return message;
};

export const generateReviewResponse = async (config: RequestConfig): Promise<GenerationResult> => {
  const response = await fetch("/api/generate-review", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(config),
  });

  const text = await response.text();
  let data: unknown;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    if (!response.ok) {
      throw new Error(normalizeErrorMessage(text || "답변 생성 중 서버 오류가 발생했습니다."));
    }

    throw new Error("서버 응답 형식이 올바르지 않습니다.");
  }

  if (!response.ok) {
    const errorMessage =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : "답변 생성 중 오류가 발생했습니다.";

    throw new Error(normalizeErrorMessage(errorMessage));
  }

  return data as GenerationResult;
};
