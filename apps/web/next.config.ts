import type { NextConfig } from "next";
import path from "node:path";

const isAwsStaticExport = process.env.AWS_STATIC_EXPORT === "true";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(process.cwd(), "../.."),
  },
  ...(isAwsStaticExport
    ? {
        output: "export" as const,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
