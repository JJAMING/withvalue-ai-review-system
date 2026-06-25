import { Plugin } from "vite";
import { generateReviewResponseOnServer } from "./reviewGenerator";
import { RequestConfig } from "../types";

const readRequestBody = async (req: import("http").IncomingMessage) => {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
};

export const localApiPlugin = (apiKey: string | undefined): Plugin => ({
  name: "local-api-plugin",
  configureServer(server) {
    server.middlewares.use("/api/generate-review", async (req, res) => {
      if (req.method !== "POST") {
        res.statusCode = 405;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "Method not allowed." }));
        return;
      }

      try {
        const body = await readRequestBody(req);
        const config = JSON.parse(body) as RequestConfig;
        const result = await generateReviewResponseOnServer(config, apiKey);

        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify(result));
      } catch (error) {
        console.error(error);
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(
          JSON.stringify({
            error: error instanceof Error ? error.message : "답변 생성 중 오류가 발생했습니다.",
          })
        );
      }
    });
  },
});
