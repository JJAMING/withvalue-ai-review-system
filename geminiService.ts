
import { RequestConfig, GenerationResult } from "./types";

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
      throw new Error(text || "답변 생성 중 서버 오류가 발생했습니다.");
    }

    throw new Error("서버 응답 형식이 올바르지 않습니다.");
  }

  if (!response.ok) {
    const errorMessage =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : "답변 생성 중 오류가 발생했습니다.";

    throw new Error(errorMessage);
  }

  return data as GenerationResult;
};
