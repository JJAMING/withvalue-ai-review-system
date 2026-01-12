
import { GoogleGenAI, Type } from "@google/genai";
import { RequestConfig, GenerationResult } from "./types";

export const generateReviewResponse = async (config: RequestConfig): Promise<GenerationResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    당신은 병원의 고객 상담 전문가입니다. 고객의 리뷰에 대해 최적의 답변을 생성하세요.
    
    [상황 정보]
    - 반응 유형: ${config.responseType}
    - 채널: ${config.channel}
    - 톤앤매너: ${config.tone}
    - 고객 내용: ${config.content}
    
    [작성 규칙]
    1. 답변의 첫 문장(헤드라인 또는 첫 인사)을 포함하여 전체 답변을 하나의 완성된 본문(body)으로 작성하세요.
    2. 채널의 특성에 맞는 길이를 유지하세요 (네이버 플레이스는 정중하고 상세하게, 카카오톡/문자는 간결하고 핵심 위주로).
    3. 선택된 톤앤매너를 완벽하게 반영하세요.
    4. 반응 유형에 따라 적절한 공감이나 해명, 감사를 포함하세요.
    5. 결과물은 반드시 JSON 형식으로 제공하세요.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: config.imageData 
      ? { parts: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: config.imageData } }] }
      : prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: '답변의 핵심 요약 (UI 상단 표시용)' },
          body: { type: Type.STRING, description: '첫 인사부터 끝인사까지 포함된 전체 답변 내용' },
          caution: { type: Type.STRING, description: '사용 시 주의사항 (의료법 준수 등)' }
        },
        required: ["title", "body", "caution"]
      }
    }
  });

  try {
    const result = JSON.parse(response.text || '{}');
    return result as GenerationResult;
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    throw new Error("답변 생성 중 오류가 발생했습니다.");
  }
};
