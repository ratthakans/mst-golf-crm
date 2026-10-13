const path = require("node:path");
const { PrismaPlugin } = require("@prisma/nextjs-monorepo-workaround-plugin");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
          // Neither site may be framed by another (clickjacking); no plugins; forms post only to us.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
