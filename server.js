
// =====================================================
// DOMYNICE HIGHER / LOWER BOT
// DERIV OAUTH 2.0 + PKCE
// EXPRESS 5
// =====================================================

import express from "express";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

// =====================================================
// PATH
// =====================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =====================================================
// EXPRESS
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

const DERIV_AUTH_URL =
  "https://auth.deriv.com/oauth2/auth";

const DERIV_TOKEN_URL =
  "https://auth.deriv.com/oauth2/token";

const DERIV_API_BASE =
  "https://api.derivws.com";

const DERIV_SCOPE =
  "trade account_manage";

const SESSION_DURATION =
  60 * 60 * 1000;

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
// SESSION STORAGE
// =====================================================

const sessions = new Map();

const oauthStates = new Map();

// =====================================================
// RANDOM STRING
// =====================================================

function randomString(length = 64) {
  return crypto
    .randomBytes(length)
    .toString("base64url");
}

// =====================================================
// PKCE
// =====================================================

function createCodeChallenge(codeVerifier) {
  return crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
}

// =====================================================
// HTML ESCAPE
// =====================================================

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// =====================================================
// SESSION COOKIE
// =====================================================

function createSessionCookie(sessionId) {
  return [
    `domynice_session=${encodeURIComponent(sessionId)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${Math.floor(
      SESSION_DURATION / 1000
    )}`
  ].join("; ");
}

// =====================================================
// READ COOKIE
// =====================================================

function getCookie(req, name) {
  const header = req.headers.cookie;

  if (!header) {
    return null;
  }

  for (const cookie of header.split(";")) {
    const trimmed = cookie.trim();

    const separator =
      trimmed.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const key =
      trimmed.substring(
        0,
        separator
      );

    const value =
      trimmed.substring(
        separator + 1
      );

    if (key === name) {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }

  return null;
}

// =====================================================
// GET SESSION
// =====================================================

function getSession(req) {
  const sessionId =
    getCookie(
      req,
      "domynice_session"
    );

  if (!sessionId) {
    return null;
  }

  const session =
    sessions.get(sessionId);

  if (!session) {
    return null;
  }

  if (
    Date.now() -
      session.createdAt >
    SESSION_DURATION
  ) {
    sessions.delete(sessionId);

    return null;
  }

  return {
    id: sessionId,
    data: session
  };
}

// =====================================================
// DERIV API REQUEST
// =====================================================

async function derivRequest(
  endpoint,
  accessToken,
  options = {}
) {
  const response =
    await fetch(
      `${DERIV_API_BASE}${endpoint}`,
      {
        ...options,

        headers: {
          Accept:
            "application/json",

          Authorization:
            `Bearer ${accessToken}`,

          ...(options.headers || {})
        }
      }
    );

  const text =
    await response.text();

  let data = {};

  try {
    data =
      text
        ? JSON.parse(text)
        : {};
  } catch {
    data = {
      raw: text
    };
  }

  if (!response.ok) {
    const message =
      data?.errors?.[0]?.message ||
      data?.error_description ||
      data?.message ||
      `Deriv API error ${response.status}`;

    const error =
      new Error(message);

    error.status =
      response.status;

    error.deriv = data;

    throw error;
  }

  return data;
}

// =====================================================
// HEALTH
// =====================================================

app.get(
  "/health",
  (req, res) => {
    res.json({
      status: "ok",

      app:
        "Domynice Higher/Lower Bot",

      oauth:
        "Deriv OAuth 2.0 + PKCE",

      client_id:
        DERIV_CLIENT_ID,

      redirect_uri:
        REDIRECT_URI
    });
  }
);

// =====================================================
// START DERIV LOGIN
// =====================================================

app.get(
  "/api/deriv/login",
  (req, res) => {
    try {
      const state =
        randomString(32);

      const codeVerifier =
        randomString(64);

      const codeChallenge =
        createCodeChallenge(
          codeVerifier
        );

      oauthStates.set(
        state,
        {
          codeVerifier,
          createdAt:
            Date.now(),
          mode:
            "login"
        }
      );

      const url =
        new URL(
          DERIV_AUTH_URL
        );

      url.searchParams.set(
        "response_type",
        "code"
      );

      url.searchParams.set(
        "client_id",
        DERIV_CLIENT_ID
      );

      url.searchParams.set(
        "redirect_uri",
        REDIRECT_URI
      );

      url.searchParams.set(
        "scope",
        DERIV_SCOPE
      );

      url.searchParams.set(
        "state",
        state
      );

      url.searchParams.set(
        "code_challenge",
        codeChallenge
      );

      url.searchParams.set(
        "code_challenge_method",
        "S256"
      );

      console.log(
        "===================================="
      );

      console.log(
        "Starting Deriv OAuth login"
      );

      console.log(
        "Client ID:",
        DERIV_CLIENT_ID
      );

      console.log(
        "Redirect URI:",
        REDIRECT_URI
      );

      console.log(
        "===================================="
      );

      return res.redirect(
        url.toString()
      );
    } catch (error) {
      console.error(
        "Deriv login error:",
        error
      );

      return res
        .status(500)
        .send(
          "Unable to start Deriv login."
        );
    }
  }
);

// =====================================================
// START DERIV SIGN UP
// =====================================================

app.get(
  "/api/deriv/signup",
  (req, res) => {
    try {
      const state =
        randomString(32);

      const codeVerifier =
        randomString(64);

      const codeChallenge =
        createCodeChallenge(
          codeVerifier
        );

      oauthStates.set(
        state,
        {
          codeVerifier,
          createdAt:
            Date.now(),
          mode:
            "signup"
        }
      );

      const url =
        new URL(
          DERIV_AUTH_URL
        );

      url.searchParams.set(
        "response_type",
        "code"
      );

      url.searchParams.set(
        "client_id",
        DERIV_CLIENT_ID
      );

      url.searchParams.set(
        "redirect_uri",
        REDIRECT_URI
      );

      url.searchParams.set(
        "scope",
        DERIV_SCOPE
      );

      url.searchParams.set(
        "state",
        state
      );

      url.searchParams.set(
        "code_challenge",
        codeChallenge
      );

      url.searchParams.set(
        "code_challenge_method",
        "S256"
      );

      url.searchParams.set(
        "prompt",
        "registration"
      );

      console.log(
        "===================================="
      );

      console.log(
        "Starting Deriv OAuth signup"
      );

      console.log(
        "Client ID:",
        DERIV_CLIENT_ID
      );

      console.log(
        "Redirect URI:",
        REDIRECT_URI
      );

      console.log(
        "===================================="
      );

      return res.redirect(
        url.toString()
      );
    } catch (error) {
      console.error(
        "Deriv signup error:",
        error
      );

      return res
        .status(500)
        .send(
          "Unable to start Deriv registration."
        );
    }
  }
);

// =====================================================
// OAUTH CALLBACK
// =====================================================

app.get(
  "/callback",
  async (req, res) => {
    try {
      const {
        code,
        state,
        error,
        error_description
      } = req.query;

      console.log(
        "===================================="
      );

      console.log(
        "Deriv OAuth callback received"
      );

      console.log(
        "===================================="
      );

      // -------------------------------------------------
      // DERIV ERROR
      // -------------------------------------------------

      if (error) {
        console.error(
          "Deriv OAuth error:",
          error,
          error_description || ""
        );

        return res
          .status(400)
          .send(`
<!DOCTYPE html>
<html>
<head>
  <title>Deriv Login Error</title>
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >
</head>

<body
  style="
    font-family:Arial;
    padding:30px;
  "
>

  <h2>Deriv Login Error</h2>

  <p>
    ${escapeHtml(
      error_description ||
      error
    )}
  </p>

  <p>
    <a href="/">
      Return to Domynice
    </a>
  </p>

</body>
</html>
          `);
      }

      // -------------------------------------------------
      // VALIDATE CODE
      // -------------------------------------------------

      if (!code) {
        return res
          .status(400)
          .send(
            "Missing authorization code."
          );
      }

      // -------------------------------------------------
      // VALIDATE STATE
      // -------------------------------------------------

      if (!state) {
        return res
          .status(400)
          .send(
            "Missing OAuth state."
          );
      }

      const oauthState =
        oauthStates.get(
          state
        );

      if (!oauthState) {
        return res
          .status(400)
          .send(
            "Invalid or expired OAuth state. Please start login again."
          );
      }

      // Prevent state reuse.
      oauthStates.delete(
        state
      );

      // -------------------------------------------------
      // CHECK STATE EXPIRATION
      // -------------------------------------------------

      if (
        Date.now() -
          oauthState.createdAt >
        10 * 60 * 1000
      ) {
        return res
          .status(400)
          .send(
            "OAuth request expired. Please login again."
          );
      }

      // -------------------------------------------------
      // EXCHANGE CODE FOR TOKEN
      // -------------------------------------------------

      console.log(
        "Exchanging Deriv authorization code..."
      );

      const body =
        new URLSearchParams();

      body.set(
        "grant_type",
        "authorization_code"
      );

      body.set(
        "client_id",
        DERIV_CLIENT_ID
      );

      body.set(
        "code",
        code
      );

      body.set(
        "code_verifier",
        oauthState.codeVerifier
      );

      body.set(
        "redirect_uri",
        REDIRECT_URI
      );

      const tokenResponse =
        await fetch(
          DERIV_TOKEN_URL,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded",

              Accept:
                "application/json"
            },

            body:
              body.toString()
          }
        );

      const tokenText =
        await tokenResponse.text();

      let tokenData = {};

      try {
        tokenData =
          tokenText
            ? JSON.parse(
                tokenText
              )
            : {};
      } catch {
        tokenData = {
          raw: tokenText
        };
      }

      if (!tokenResponse.ok) {
        console.error(
          "Deriv token exchange failed:",
          tokenData
        );

        return res
          .status(502)
          .send(`
<!DOCTYPE html>
<html>
<head>
  <title>Deriv Authorization Failed</title>
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >
</head>

<body
  style="
    font-family:Arial;
    padding:30px;
  "
>

  <h2>Deriv Authorization Failed</h2>

  <p>
    Please return to Domynice and try again.
  </p>

  <a href="/">
    Return to Domynice
  </a>

</body>
</html>
          `);
      }

      const accessToken =
        tokenData.access_token;

      if (!accessToken) {
        console.error(
          "No access token received:",
          tokenData
        );

        return res
          .status(502)
          .send(
            "Deriv did not return an access token."
          );
      }

      console.log(
        "Deriv OAuth token received successfully."
      );

      // -------------------------------------------------
      // GET DERIV ACCOUNTS
      // -------------------------------------------------

      console.log(
        "Requesting Demo and Real Deriv accounts..."
      );

      let accounts = [];

      try {
        const accountsResponse =
          await derivRequest(
            "/trading/v1/options/accounts",
            accessToken
          );

        const returned =
          accountsResponse?.data;

        if (
          Array.isArray(
            returned
          )
        ) {
          accounts =
            returned;
        } else if (
          returned
        ) {
          accounts = [
            returned
          ];
        }

        console.log(
          "Deriv accounts found:",
          accounts.length
        );
      } catch (error) {
        console.error(
          "Could not retrieve Deriv accounts:",
          error.message
        );

        accounts = [];
      }

      // -------------------------------------------------
      // FIND DEMO ACCOUNT
      // -------------------------------------------------

      const demoAccount =
        accounts.find(
          account =>
            account?.account_type ===
            "demo"
        ) || null;

      // -------------------------------------------------
      // FIND REAL ACCOUNT
      // -------------------------------------------------

      const realAccount =
        accounts.find(
          account =>
            account?.account_type ===
            "real"
        ) || null;

      // -------------------------------------------------
      // SELECT DEFAULT ACCOUNT
      // -------------------------------------------------

      const selectedAccount =
        demoAccount ||
        realAccount ||
        accounts[0] ||
        null;

      // -------------------------------------------------
      // CREATE SESSION
      // -------------------------------------------------

      const sessionId =
        randomString(48);

      sessions.set(
        sessionId,
        {
          createdAt:
            Date.now(),

          accessToken,

          tokenType:
            tokenData.token_type ||
            "Bearer",

          expiresIn:
            tokenData.expires_in ||
            3600,

          accounts,

          selectedAccount,

          oauthMode:
            oauthState.mode
        }
      );

      // -------------------------------------------------
      // SET SESSION COOKIE
      // -------------------------------------------------

      res.setHeader(
        "Set-Cookie",
        createSessionCookie(
          sessionId
        )
      );

      console.log(
        "Domynice Deriv session created."
      );

      console.log(
        "Selected account:",
        selectedAccount?.account_id ||
          "none"
      );

      console.log(
        "Selected account type:",
        selectedAccount?.account_type ||
          "none"
      );

      // -------------------------------------------------
      // RETURN TO FRONTEND
      // -------------------------------------------------

      return res.redirect(
        "/?deriv_connected=1"
      );
    } catch (error) {
      console.error(
        "===================================="
      );

      console.error(
        "OAuth callback error:",
        error
      );

      console.error(
        "===================================="
      );

      return res
        .status(500)
        .send(`
<!DOCTYPE html>
<html>
<head>
  <title>Domynice OAuth Error</title>
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >
</head>

<body
  style="
    font-family:Arial;
    padding:30px;
  "
>

  <h2>Domynice OAuth Error</h2>

  <p>
    We
