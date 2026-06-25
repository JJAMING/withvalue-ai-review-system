import type { IncomingMessage, ServerResponse } from "http";
import { generateReviewResponseOnServer } from "../server/reviewGenerator.js";
import { RequestConfig } from "../types.js";

export const config = {
  maxDuration: 60,
};

const readJsonBody = async (req: IncomingMessage): Promise<RequestConfig> => {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as RequestConfig;
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  console.log("[api/generate-review] request received", { method: req.method });

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Method not allowed." }));
    return;
  }

  try {
    const config = await readJsonBody(req);
    console.log("[api/generate-review] request parsed", {
      hasContent: Boolean(config.content?.trim()),
      hasImage: Boolean(config.imageData),
      imageMimeType: config.imageMimeType,
    });

    const result = await generateReviewResponseOnServer(config, process.env.GEMINI_API_KEY);
    console.log("[api/generate-review] response generated");

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(result));
  } catch (error) {
    console.error("[api/generate-review] failed", error);
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : "답변 생성 중 오류가 발생했습니다.",
      })
    );
  }
}
