/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Serve the OAuth discovery documents at their well-known URLs (what MCP
  // clients fetch) while the handlers live under /api/oauth/* (dot-folders in
  // the app dir aren't reliably routed).
  async rewrites() {
    return [
      {
        source: "/.well-known/oauth-authorization-server",
        destination: "/api/oauth/authorization-server-metadata",
      },
      {
        source: "/.well-known/oauth-protected-resource",
        destination: "/api/oauth/protected-resource-metadata",
      },
      {
        source: "/.well-known/oauth-protected-resource/api/mcp",
        destination: "/api/oauth/protected-resource-metadata",
      },
    ];
  },
};

export default nextConfig;
