import http from "node:http";
import https from "node:https";
import type { NextApiRequest, NextApiResponse } from "next";

import { withApiLogging } from "@kan/api/utils/apiLogging";
import { withRateLimit } from "@kan/api/utils/rateLimit";

import { env } from "~/env";

/**
 * GETs a presigned storage URL. With S3_INTERNAL_ENDPOINT set, the request
 * goes to that address instead of the public one (which may be unreachable
 * from inside the server) but keeps the public Host header, because the URL's
 * signature covers it and storage still checks it.
 */
function getPresigned(url: URL, internalEndpoint: string | undefined) {
  const target = internalEndpoint ? new URL(internalEndpoint) : url;
  const client = target.protocol === "https:" ? https : http;
  return new Promise<{ status: number; contentType?: string; body: Buffer }>(
    (resolve, reject) => {
      const request = client.request(
        {
          protocol: target.protocol,
          hostname: target.hostname,
          port: target.port || undefined,
          path: `${url.pathname}${url.search}`,
          method: "GET",
          headers: { host: url.host },
          timeout: 30_000,
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("end", () =>
            resolve({
              status: response.statusCode ?? 502,
              contentType: response.headers["content-type"],
              body: Buffer.concat(chunks),
            }),
          );
          response.on("error", reject);
        },
      );
      request.on("timeout", () => request.destroy(new Error("timeout")));
      request.on("error", reject);
      request.end();
    },
  );
}

export default withRateLimit(
  { points: 100, duration: 60 },
  withApiLogging(async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== "GET") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    const { url, filename } = req.query;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ message: "url parameter is required" });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).json({ message: "Invalid URL" });
    }

    const s3Endpoint = env.S3_ENDPOINT;

    if (s3Endpoint) {
      const hostname = parsed.hostname.toLowerCase();
      let allowedHost: string;
      try {
        allowedHost = new URL(s3Endpoint).hostname.toLowerCase();
      } catch {
        return res
          .status(500)
          .json({ message: "Storage endpoint misconfigured" });
      }

      if (hostname !== allowedHost && !hostname.endsWith(`.${allowedHost}`)) {
        return res.status(403).json({ message: "URL not allowed" });
      }
    }

    try {
      const downloadFilename =
        typeof filename === "string"
          ? encodeURIComponent(filename)
          : "attachment";

      const upstream = await getPresigned(parsed, env.S3_INTERNAL_ENDPOINT);

      if (upstream.status < 200 || upstream.status >= 300) {
        return res
          .status(upstream.status)
          .json({ message: "Failed to fetch attachment" });
      }

      const contentType = upstream.contentType ?? "application/octet-stream";

      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${downloadFilename}"; filename*=UTF-8''${downloadFilename}`,
      );

      return res.send(upstream.body);
    } catch (error) {
      return res.status(500).json({ message: "Failed to download attachment" });
    }
  }),
);
