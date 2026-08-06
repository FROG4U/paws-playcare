import type { NextConfig } from "next";

// Content-Security-Policy. Allows Stripe.js + Stripe Elements (payments) and the
// app's own inline scripts/styles (Next hydration + Tailwind/inline styles),
// while blocking framing, plugins and cross-origin script/connect sources.
// React needs eval() in DEV only (debugging); production never does, so we keep
// 'unsafe-eval' out of the production CSP.
const scriptSrc =
  process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline' https://js.stripe.com"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com";

const csp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.stripe.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
];

const nextConfig: NextConfig = {
  // These read data files from node_modules at runtime — keep them out of the
  // bundle so those reads work in the server build.
  serverExternalPackages: ["pdfkit", "sanitize-html"],
  // In production the custom server.js sets these headers (next.config headers()
  // isn't reliably applied with a custom server), so only apply them here for
  // local dev (`next dev`) to avoid sending them twice.
  async headers() {
    if (process.env.NODE_ENV === "production") return [];
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
