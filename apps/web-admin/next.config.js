/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages are shipped as TypeScript source — let Next transpile them.
  transpilePackages: ["@mstgolf/analytics", "@mstgolf/shared", "@mstgolf/database"],
  // The old in-app sign-up form now lives at the public sign-up link.
  async redirects() {
    return [{ source: "/join", destination: "/register", permanent: false }];
  },
};

module.exports = nextConfig;
