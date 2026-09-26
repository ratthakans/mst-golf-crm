const { PrismaPlugin } = require("@prisma/nextjs-monorepo-workaround-plugin");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages are shipped as TypeScript source — let Next transpile them.
  transpilePackages: ["@mstgolf/analytics", "@mstgolf/shared", "@mstgolf/database", "@mstgolf/core"],
  webpack: (config, { isServer }) => {
    // In a pnpm monorepo the bundled Prisma client cannot find its native query
    // engine; this copies the engine next to the server bundle.
    if (isServer) config.plugins = [...config.plugins, new PrismaPlugin()];
    return config;
  },
};

module.exports = nextConfig;
