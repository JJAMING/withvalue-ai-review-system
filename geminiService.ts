
import { RequestConfig, GenerationResult } from "./types";

export const generateReviewResponse = async (config: RequestConfig): Promise<GenerationResult> => {
  const response = await fetch("/api/generate-review", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(config),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "답변 생성 중 오류가 발생했습니다.");
  }

  return data as GenerationResult;
};
