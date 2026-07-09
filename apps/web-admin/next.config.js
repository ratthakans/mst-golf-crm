/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages are shipped as TypeScript source — let Next transpile them.
  transpilePackages: ["@mstgolf/analytics", "@mstgolf/shared", "@mstgolf/database"],
};

module.exports = nextConfig;
