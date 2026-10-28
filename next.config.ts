import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Curated guides are read from disk at runtime; make sure serverless bundles include them.
  outputFileTracingIncludes: { "/**": ["./data/library/**"] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
