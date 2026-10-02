
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

app.use(express.static(__dirname));

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
// COOKIE
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
    const separator = trimmed.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const key = trimmed.substring(0, separator);
    const value = trimmed.substring(separator + 1);

    if (key === name) {
      return decodeURIComponent(value);
    }
  }

  return null;
}

// =====================================================
// GET SESSION
// =====================================================

function getSession(req) {
  const sessionId =
    getCookie(req, "domynice_session");

  if (!sessionId) {
    return null;
  }

  const session = sessions.get(sessionId);

  if (!session) {
    return null;
  }

  if (
    Date.now() - session.createdAt >
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
  const response = await fetch(
    `${DERIV_API_BASE}${endpoint}`,
    {
      ...options,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(options.headers || {})
      }
    }
  );

  const text = await response.text();

  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
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

    const error = new Error(message);

    error.status = response.status;
    error.deriv = data;

    throw error;
  }

  return data;
}

// =====================================================
// HEALTH
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
// START DERIV LOGIN
// =====================================================

app.get("/api/deriv/login", (req, res) => {
  try {
    const state = randomString(32);
    const codeVerifier = randomString(64);
    const codeChallenge =
      createCodeChallenge(codeVerifier);

    oauthStates.set(state, {
      codeVerifier,
      createdAt: Date.now(),
      mode: "login"
    });

    const url = new URL(DERIV_AUTH_URL);

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

    res.redirect(url.toString());
  } catch (error) {
    console.error(
      "Deriv login error:",
      error
    );

    res.status(500).send(
      "Unable to start Deriv login."
    );
  }
});

// =====================================================
// START DERIV SIGN UP
// =====================================================

app.get("/api/deriv/signup", (req, res) => {
  try {
    const state = randomString(32);
    const codeVerifier = randomString(64);
    const codeChallenge =
      createCodeChallenge(codeVerifier);

    oauthStates.set(state, {
      codeVerifier,
      createdAt: Date.now(),
      mode: "signup"
    });

    const url = new URL(DERIV_AUTH_URL);

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

    res.redirect(url.toString());
  } catch (error) {
    console.error(
      "Deriv signup error:",
      error
    );

    res.status(500).send(
      "Unable to start Deriv registration."
    );
  }
});

// =====================================================
// OAUTH CALLBACK
// =====================================================

app.get("/callback", async (req, res) => {
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

      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Deriv Login Error</title>
          <meta name="viewport"
                content="width=device-width, initial-scale=1">
        </head>
        <body style="font-family:Arial;padding:30px">
          <h2>Deriv Login Error</h2>
          <p>${escapeHtml(
            error_description || error
          )}</p>
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
      return res.status(400).send(
        "Missing authorization code."
      );
    }

    // -------------------------------------------------
    // VALIDATE STATE
    // -------------------------------------------------

    if (!state) {
      return res.status(400).send(
        "Missing OAuth state."
      );
    }

    const oauthState =
      oauthStates.get(state);

    if (!oauthState) {
      return res.status(400).send(
        "Invalid or expired OAuth state. Please start login again."
      );
    }

    // Delete immediately to prevent reuse.
    oauthStates.delete(state);

    // -------------------------------------------------
    // CHECK STATE EXPIRATION
    // -------------------------------------------------

    if (
      Date.now() -
        oauthState.createdAt >
      10 * 60 * 1000
    ) {
      return res.status(400).send(
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
          method: "POST",

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
          ? JSON.parse(tokenText)
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

      return res.status(502).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Deriv Authorization Failed</title>
          <meta name="viewport"
                content="width=device-width, initial-scale=1">
        </head>
        <body style="font-family:Arial;padding:30px">
          <h2>Deriv Authorization Failed</h2>
          <p>
            Please return to Domynice and try again.
          </p>
          <a href="/">Return to Domynice</a>
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

      return res.status(502).send(
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

      if (Array.isArray(returned)) {
        accounts = returned;
      } else if (returned) {
        accounts = [returned];
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

      // OAuth succeeded even if account retrieval
      // temporarily fails. The session can still exist.
      accounts = [];
    }

    // -------------------------------------------------
    // FIND DEMO / REAL ACCOUNTS
    // -------------------------------------------------

    const demoAccount =
      accounts.find(
        account =>
          account?.account_type === "demo"
      ) || null;

    const realAccount =
      accounts.find(
        account =>
          account?.account_type === "real"
      ) || null;

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

    sessions.set(sessionId, {
      createdAt: Date.now(),

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
    });

    // -------------------------------------------------
    // SET SECURE COOKIE
    // -------------------------------------------------

    res.setHeader(
      "Set-Cookie",
      createSessionCookie(sessionId)
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

    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Domynice OAuth Error</title>
        <meta name="viewport"
              content="width=device-width, initial-scale=1">
      </head>
      <body style="font-family:Arial;padding:30px">
        <h2>Domynice OAuth Error</h2>
        <p>
          We could not complete the Deriv connection.
        </p>
        <p>
          Please return to Domynice and try again.
        </p>
        <a href="/">Return to Domynice</a>
      </body>
      </html>
    `);
  }
});

// =====================================================
// CURRENT DERIV SESSION
// =====================================================

app.get(
  "/api/deriv-session",
  async (req, res) => {
    try {
      const session =
        getSession(req);

      if (!session) {
        return res.status(401).json({
          connected: false,
          error:
            "No authenticated Deriv session."
        });
      }

      const data =
        session.data;

      let accounts =
        data.accounts || [];

      // -------------------------------------------------
      // REFRESH ACCOUNTS
      // -------------------------------------------------

      try {
        const latest =
          await derivRequest(
            "/trading/v1/options/accounts",
            data.accessToken
          );

        if (
          Array.isArray(
            latest?.data
          )
        ) {
          accounts =
            latest.data;
        } else if (
          latest?.data
        ) {
          accounts = [
            latest.data
          ];
        }

        data.accounts =
          accounts;
      } catch (error) {
        console.error(
          "Account refresh failed:",
          error.message
        );
      }

      // -------------------------------------------------
      // DEMO / REAL
      // -------------------------------------------------

      const demoAccounts =
        accounts.filter(
          account =>
            account?.account_type ===
            "demo"
        );

      const realAccounts =
        accounts.filter(
          account =>
            account?.account_type ===
            "real"
        );

      // -------------------------------------------------
      // SELECTED ACCOUNT
      // -------------------------------------------------

      let selected =
        data.selectedAccount ||
        null;

      if (selected?.account_id) {
        selected =
          accounts.find(
            account =>
              account?.account_id ===
              selected.account_id
          ) || null;
      }

      if (!selected) {
        selected =
          demoAccounts[0] ||
          realAccounts[0] ||
          accounts[0] ||
          null;

        data.selectedAccount =
          selected;
      }

      // -------------------------------------------------
      // RETURN SAFE DATA
      // -------------------------------------------------

      return res.json({
        connected: true,

        account: selected,

        selected_account:
          selected,

        demo_accounts:
          demoAccounts,

        real_accounts:
          realAccounts,

        accounts
      });
    } catch (error) {
      console.error(
        "Deriv session error:",
        error
      );

      return res.status(500).json({
        connected: false,
        error:
          "Unable to read Deriv session."
      });
    }
  }
);

// =====================================================
// SELECT DERIV ACCOUNT
// =====================================================

app.post(
  "/api/deriv/select-account",
  (req, res) => {
    try {
      const session =
        getSession(req);

      if (!session) {
        return res.status(401).json({
          success: false,
          error:
            "Not connected to Deriv."
        });
      }

      const {
        account_id
      } = req.body || {};

      if (!account_id) {
        return res.status(400).json({
          success: false,
          error:
            "account_id is required."
        });
      }

      const account =
        session.data.accounts.find(
          item =>
            item?.account_id ===
            account_id
        );

      if (!account) {
        return res.status(404).json({
          success: false,
          error:
            "Deriv account was not found."
        });
      }

      session.data.selectedAccount =
        account;

      return res.json({
        success: true,
        account
      });
    } catch (error) {
      console.error(
        "Select account error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to select account."
      });
    }
  }
);

// =====================================================
// LOGOUT
// =====================================================

app.post(
  "/api/deriv/logout",
  (req, res) => {
    const sessionId =
      getCookie(
        req,
        "domynice_session"
      );

    if (sessionId) {
      sessions.delete(sessionId);
    }

    res.setHeader(
      "Set-Cookie",
      "domynice_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
    );

    return res.json({
      success: true,
      connected: false
    });
  }
);

// =====================================================
// CLEAN EXPIRED OAUTH STATES
// =====================================================

setInterval(() => {
  const now = Date.now();

  for (
    const [state, data]
    of oauthStates.entries()
  ) {
    if (
      now - data.createdAt >
      10 * 60 * 1000
    ) {
      oauthStates.delete(state);
    }
  }

  for (
    const [sessionId, data]
    of sessions.entries()
  ) {
    if (
      now - data.createdAt >
      SESSION_DURATION
    ) {
      sessions.delete(sessionId);
    }
  }
}, 60 * 1000);

// =====================================================
// FALLBACK
// =====================================================

app.use(
  (req, res, next) => {
    if (
      req.method === "GET" &&
      !req.path.startsWith("/api/")
    ) {
      return res.sendFile(
        path.join(
          __dirname,
          "index.html"
        )
      );
    }

    next();
  }
);

// =====================================================
// 404 API
// =====================================================

app.use(
  (req, res) => {
    res.status(404).json({
      error: "Route not found",
      path: req.path
    });
  }
);

// =====================================================
// SERVER
// =====================================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      "===================================="
    );

    console.log(
      "Domynice Higher/Lower Bot"
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
  }
);
