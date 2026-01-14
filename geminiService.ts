
import { GoogleGenAI, Type } from "@google/genai";
import { RequestConfig, GenerationResult } from "./types";

export const generateReviewResponse = async (config: RequestConfig): Promise<GenerationResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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
    model: 'gemini-3-flash-preview',
    contents: config.imageData 
      ? { parts: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: config.imageData } }] }
      : prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: '답변의 핵심 요약' },
          body: { type: Type.STRING, description: '전체 답변 내용' },
          caution: { type: Type.STRING, description: '사용 시 주의사항' }
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
