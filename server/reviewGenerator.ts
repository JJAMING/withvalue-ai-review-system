import { GoogleGenAI, Type } from "@google/genai";
import { GenerationResult, RequestConfig } from "../types.js";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const isGenerationResult = (value: unknown): value is GenerationResult => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const result = value as Partial<GenerationResult>;
  return (
    typeof result.title === "string" &&
    typeof result.body === "string" &&
    typeof result.caution === "string" &&
    result.title.trim().length > 0 &&
    result.body.trim().length > 0 &&
    result.caution.trim().length > 0
  );
};

const getBase64Size = (base64: string) => Buffer.byteLength(base64, "base64");

export const generateReviewResponseOnServer = async (
  config: RequestConfig,
  apiKey: string | undefined
): Promise<GenerationResult> => {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  if (!config.hospitalName?.trim()) {
    throw new Error("치과명을 입력해 주세요.");
  }

  if (!config.content?.trim() && !config.imageData) {
    throw new Error("리뷰 내용이나 사진을 제공해 주세요.");
  }

  if (config.imageData) {
    if (!config.imageMimeType?.startsWith("image/")) {
      throw new Error("지원하지 않는 이미지 형식입니다.");
    }

    if (getBase64Size(config.imageData) > MAX_IMAGE_BYTES) {
      throw new Error("이미지는 5MB 이하만 첨부할 수 있습니다.");
    }
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `
    당신은 병원의 고객 상담 전문가입니다. 고객의 리뷰에 대해 최적의 답변을 생성하세요.
    
    [상황 정보]
    - 치과명: ${config.hospitalName}
    - 반응 유형: ${config.responseType}
    - 채널: ${config.channel}
    - 톤앤매너: ${config.tone}
    - 커뮤니케이션 톤(종결어미): ${config.endingStyle}
    - 고객 내용: ${config.content}
    
    [작성 규칙 - 매우 중요]
    1. 답변의 첫 문장은 반드시 "안녕하세요. ${config.hospitalName}입니다."로 시작해야 합니다.
    2. 전체 답변의 문장 끝맺음(종결 어미)은 반드시 "${config.endingStyle}" 스타일을 사용하세요.
       - 만약 '~에요'가 선택되었다면: "감사해요", "환영해요", "도와드릴게요" 등 부드러운 구어체를 사용하세요.
       - 만약 '~입니다'가 선택되었다면: "감사합니다", "환영합니다", "도와드리겠습니다" 등 격식 있는 문체를 사용하세요.
    3. 첫 문장 이후에는 선택된 톤앤매너(${config.tone})와 채널 특성에 맞춰 내용을 이어가세요.
    4. 전체 답변을 하나의 완성된 본문(body)으로 작성하세요.
    5. 채널의 특성에 맞는 길이를 유지하세요.
    6. 결과물은 반드시 JSON 형식으로 제공하세요.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: config.imageData
      ? {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: config.imageMimeType,
                data: config.imageData,
              },
            },
          ],
        }
      : prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "답변의 핵심 요약" },
          body: { type: Type.STRING, description: "전체 답변 내용" },
          caution: { type: Type.STRING, description: "사용 시 주의사항" },
        },
        required: ["title", "body", "caution"],
      },
    },
  });

  let result: unknown;

  try {
    result = JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    throw new Error("AI 응답을 JSON으로 해석하지 못했습니다.");
  }

  if (!isGenerationResult(result)) {
    throw new Error("AI 응답 형식이 올바르지 않습니다.");
  }

  return result;
};
