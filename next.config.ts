import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit reads its font-metric files from node_modules at runtime — keep it
  // out of the bundle so those reads work in the server build.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
