import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const config = req.body;

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!,
    });

    const prompt = `
당신은 병원의 고객 상담 전문가입니다. 고객의 리뷰에 대해 최적의 답변을 생성하세요.

[상황 정보]
- 반응 유형: ${config.responseType}
- 채널: ${config.channel}
- 톤앤매너: ${config.tone}
- 고객 내용: ${config.content}

[작성 규칙]
1. 첫 문장부터 끝까지 하나의 본문으로 작성
2. 채널 특성 반영
3. 톤앤매너 완벽 반영
4. 공감/해명/감사 포함
5. JSON 형식으로만 응답
`;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: config.imageData
        ? {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: "image/jpeg",
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
            title: { type: Type.STRING },
            body: { type: Type.STRING },
            caution: { type: Type.STRING },
          },
          required: ["title", "body", "caution"],
        },
      },
    });

    res.status(200).json(JSON.parse(response.text!));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
