
// =====================================================
// DOMYNICE HIGHER & LOWER BOT
// Deriv OAuth 2.0 + PKCE
// Express Server
// =====================================================

import express from "express";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

// =====================================================
// PATH SETUP
// =====================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =====================================================
// EXPRESS APP
// =====================================================

const app = express();

const PORT = process.env.PORT || 10000;

// =====================================================
// DERIV CONFIGURATION
// =====================================================

const DERIV_CLIENT_ID =
  process.env.DERIV_CLIENT_ID ||
  "34xmNA7aCdIQnbxlGEhIw";

const REDIRECT_URI =
  process.env.DERIV_REDIRECT_URI ||
  "https://domynice-higher-lower-bot.onrender.com/callback";

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true
  })
);

// Serve all frontend files.
app.use(
  express.static(__dirname)
);

// =====================================================
// EXPLICIT FRONTEND HOME
// =====================================================

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    app: "Domynice Higher/Lower Bot",
    oauth: "Deriv OAuth 2.0 + PKCE",
    client_id: DERIV_CLIENT_ID,
    redirect_uri: REDIRECT_URI
  });
});

// =====================================================
// SERVER STATUS
// =====================================================

app.get("/api/status", (req, res) => {
  res.json({
    status: "online",
    app: "Domynice Higher & Lower Bot",
    platform: "Deriv",
    environment: "production",
    demo_supported: true,
    real_supported: true,
    oauth: "Deriv OAuth 2.0 + PKCE"
  });
});

// =====================================================
// OAUTH CONFIGURATION
// =====================================================

app.get("/api/oauth/config", (req, res) => {
  res.json({
    client_id: DERIV_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    authorization_endpoint:
      "https://oauth.deriv.com/oauth2/authorize",
    token_endpoint:
      "https://oauth.deriv.com/oauth2/token"
  });
});

// =====================================================
// PKCE HELPERS
// =====================================================

function base64Url(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createCodeVerifier() {
  return base64Url(
    crypto.randomBytes(32)
  );
}

function createCodeChallenge(verifier) {
  return base64Url(
    crypto
      .createHash("sha256")
      .update(verifier)
      .digest()
  );
}

// =====================================================
// LOGIN
// =====================================================

app.get("/login", (req, res) => {
  const state = base64Url(
    crypto.randomBytes(24)
  );

  const codeVerifier =
    createCodeVerifier();

  const codeChallenge =
    createCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    client_id: DERIV_CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256"
  });

  const authorizationUrl =
    "https://oauth.deriv.com/oauth2/authorize?" +
    params.toString();

  res.redirect(authorizationUrl);
});

// =====================================================
// OAUTH CALLBACK
// =====================================================

app.get("/callback", async (req, res) => {
  const {
    code,
    error,
    error_description
  } = req.query;

  // User cancelled or Deriv returned an error.
  if (error) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Domynice - Login Error</title>
        <meta name="viewport"
              content="width=device-width, initial-scale=1.0">
      </head>

      <body style="
        font-family: Arial, sans-serif;
        background:#0f172a;
        color:white;
        padding:40px;
        text-align:center;
      ">

        <h1>Deriv Login Error</h1>

        <p>
          ${error_description || error}
        </p>

        <a href="/" style="
          display:inline-block;
          margin-top:20px;
          padding:12px 20px;
          background:#3b82f6;
          color:white;
          text-decoration:none;
          border-radius:8px;
        ">
          Return to Domynice Bot
        </a>

      </body>
      </html>
    `);
  }

  // No authorization code.
  if (!code) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Domynice - OAuth Error</title>
      </head>

      <body style="
        font-family:Arial,sans-serif;
        background:#0f172a;
        color:white;
        padding:40px;
        text-align:center;
      ">

        <h1>OAuth Error</h1>

        <p>
          No authorization code was returned by Deriv.
        </p>

        <a href="/" style="
          color:#60a5fa;
        ">
          Return to Bot
        </a>

      </body>
      </html>
    `);
  }

  // ---------------------------------------------------
  // Exchange authorization code for token.
  // ---------------------------------------------------

  try {
    const tokenResponse =
      await fetch(
        "https://oauth.deriv.com/oauth2/token",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded"
          },

          body:
            new URLSearchParams({
              grant_type:
                "authorization_code",

              client_id:
                DERIV_CLIENT_ID,

              code,

              redirect_uri:
                REDIRECT_URI
            })
        }
      );

    const tokenData =
      await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error(
        "Deriv token error:",
        tokenData
      );

      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Domynice - Token Error</title>
        </head>

        <body style="
          font-family:Arial,sans-serif;
          background:#0f172a;
          color:white;
          padding:40px;
          text-align:center;
        ">

          <h1>Deriv Connection Failed</h1>

          <p>
            Deriv did not accept the OAuth authorization.
          </p>

          <a href="/" style="
            color:#60a5fa;
          ">
            Return to Bot
          </a>

        </body>
        </html>
      `);
    }

    // -------------------------------------------------
    // IMPORTANT:
    // Tokens are returned to the browser through a
    // temporary HTML page.
    // -------------------------------------------------

    const safeToken =
      JSON.stringify(tokenData)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026");

    return res.send(`
      <!DOCTYPE html>
      <html>

      <head>
        <meta charset="UTF-8">

        <meta
          name="viewport"
          content="width=device-width,
                   initial-scale=1.0"
        >

        <title>
          Domynice Higher & Lower Bot
        </title>
      </head>

      <body style="
        margin:0;
        background:#0f172a;
        color:white;
        font-family:Arial,sans-serif;
        display:flex;
        align-items:center;
        justify-content:center;
        min-height:100vh;
        text-align:center;
      ">

        <div>

          <h1>
            Deriv Account Connected
          </h1>

          <p>
            Redirecting to Domynice Bot...
          </p>

        </div>

        <script>
          const tokenData =
            ${safeToken};

          try {

            localStorage.setItem(
              "domynice_deriv_oauth",
              JSON.stringify(tokenData)
            );

          } catch (e) {

            console.error(
              "Could not save OAuth data",
              e
            );

          }

          setTimeout(() => {

            window.location.replace("/");

          }, 800);

        </script>

      </body>
      </html>
    `);

  } catch (err) {

    console.error(
      "OAuth callback error:",
      err
    );

    return res.status(500).send(`
      <!DOCTYPE html>
      <html>

      <head>
        <meta charset="UTF-8">
        <title>Domynice - Server Error</title>
      </head>

      <body style="
        font-family:Arial,sans-serif;
        background:#0f172a;
        color:white;
        padding:40px;
        text-align:center;
      ">

        <h1>
          Server Error
        </h1>

        <p>
          Could not complete the Deriv login.
        </p>

        <a href="/" style="
          color:#60a5fa;
        ">
          Return to Bot
        </a>

      </body>
      </html>
    `);
  }
});

// =====================================================
// 404 HANDLER
// =====================================================

app.use((req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html>

    <head>
      <meta charset="UTF-8">

      <meta
        name="viewport"
        content="width=device-width,
                 initial-scale=1.0"
      >

      <title>
        Domynice - Page Not Found
      </title>
    </head>

    <body style="
      margin:0;
      background:#0f172a;
      color:white;
      font-family:Arial,sans-serif;
      display:flex;
      justify-content:center;
      align-items:center;
      min-height:100vh;
      text-align:center;
    ">

      <div>

        <h1>
          404
        </h1>

        <h2>
          Page Not Found
        </h2>

        <p>
          The requested page does not exist.
        </p>

        <a href="/" style="
          display:inline-block;
          margin-top:15px;
          padding:12px 20px;
          background:#3b82f6;
          color:white;
          text-decoration:none;
          border-radius:8px;
        ">
          Open Domynice Bot
        </a>

      </div>

    </body>
    </html>
  `);
});

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {

  console.log(
    "===================================="
  );

  console.log(
    "Domynice Higher & Lower Bot"
  );

  console.log(
    "Server is running."
  );

  console.log(
    "Port:",
    PORT
  );

  console.log(
    "Deriv OAuth Client ID:",
    DERIV_CLIENT_ID
  );

  console.log(
    "Deriv Redirect URI:",
    REDIRECT_URI
  );

  console.log(
    "===================================="
  );

});
