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

app.prepare().then(() => {
  createServer((req, res) => {
    handle(req, res, parse(req.url, true));
  }).listen(port, () => {
    console.log(`Paws Playcare running on port ${port}`);
  });
});
