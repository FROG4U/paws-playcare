// Production startup file for Plesk (Phusion Passenger) / any Node host.
// Plesk → Node.js → "Application Startup File" = server.js, Mode = production.
// Passenger provides PORT; we hand every request to Next's built server.
//
// Requires a production build first:  npm run build

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const port = process.env.PORT || 3000;
const app = next({ dev: false });
const handle = app.getRequestHandler();

// Security headers set here (not just next.config) because a custom server does
// not reliably apply next.config's headers() in production. Production CSP has
// NO 'unsafe-eval' (only dev/React needs it); it allows Stripe.js + Elements.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com",
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

const SECURITY_HEADERS = {
  "Content-Security-Policy": CSP,
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // No includeSubDomains until the www subdomain is on the TLS cert — otherwise
  // HSTS would hard-block www.pawsplaycare.co.uk with no bypass.
  "Strict-Transport-Security": "max-age=31536000",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

app.prepare().then(() => {
  createServer((req, res) => {
    for (const key in SECURITY_HEADERS) res.setHeader(key, SECURITY_HEADERS[key]);
    handle(req, res, parse(req.url, true));
  }).listen(port, () => {
    console.log(`Paws Playcare running on port ${port}`);
  });
});
