const fs = require("node:fs");
const path = require("node:path");

// MST's licensed Futura webfont is switched on by dropping the files into
// public/fonts/futura (see the README there). Decided at build time, because
// public/ is served from the CDN and isn't inside the server bundle.
const hasFutura = fs.existsSync(path.join(__dirname, "public/fonts/futura/futura-700.woff2"));
const { PrismaPlugin } = require("@prisma/nextjs-monorepo-workaround-plugin");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: { NEXT_PUBLIC_FUTURA: hasFutura ? "1" : "" },
  // Photos MST uploads in the back office live in the public Blob store.
  images: { remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }] },
  // Workspace packages are shipped as TypeScript source — let Next transpile them.
  transpilePackages: ["@mstgolf/core", "@mstgolf/shared", "@mstgolf/database"],
  experimental: {
    // pnpm monorepo: trace server files (Prisma engine included) from the repo root.
    outputFileTracingRoot: path.join(__dirname, "../../"),
  },
  // @prisma/client is bundled (via @mstgolf/database in transpilePackages); this
  // copies the query engine next to the server bundle so it can be found.
  webpack: (config, { isServer }) => {
    if (isServer) config.plugins = [...config.plugins, new PrismaPlugin()];
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
