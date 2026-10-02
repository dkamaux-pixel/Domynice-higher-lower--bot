// =====================================================
// DOMYNICE HIGHER & LOWER BOT
// Public Deriv Platform
// Deriv OAuth 2.0 + PKCE
// =====================================================

import express from "express";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// OAuth permissions needed by the platform.
const DERIV_SCOPE =
  "trade account_manage";

// =====================================================
// SIMPLE SERVER-SIDE SESSION STORE
// =====================================================
//
// Each browser receives a random session ID.
// The Deriv access token stays on the server.
//
// For the current single Render instance this is enough
// for testing OAuth. Later we should move sessions to
// persistent storage before a large public launch.
// =====================================================

const sessions = new Map();

const SESSION_COOKIE =
  "domynice_session";

const SESSION_MAX_AGE =
  60 * 60 * 1000; // 1 hour

// =====================================================
// EXPRESS CONFIGURATION
// =====================================================

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true
  })
);

// Serve the existing frontend files.
app.use(
  express.static(__dirname)
);

// =====================================================
// SECURITY / COOKIE HELPERS
// =====================================================

function parseCookies(req) {
  const header =
    req.headers.cookie;

  if (!header) {
    return {};
  }

  const cookies = {};

  header
    .split(";")
    .forEach((part) => {
      const index =
        part.indexOf("=");

      if (index === -1) {
        return;
      }

      const key =
        part
          .slice(0, index)
          .trim();

      const value =
        part
          .slice(index + 1)
          .trim();

      cookies[key] =
        decodeURIComponent(value);
    });

  return cookies;
}

function getSession(req) {
  const cookies =
    parseCookies(req);

  const sessionId =
    cookies[SESSION_COOKIE];

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
    SESSION_MAX_AGE
  ) {
    sessions.delete(sessionId);
    return null;
  }

  return {
    id: sessionId,
    ...session
  };
}

function createSession(data = {}) {
  const sessionId =
    crypto.randomBytes(32)
      .toString("hex");

  sessions.set(
    sessionId,
    {
      ...data,
      createdAt: Date.now()
    }
  );

  return sessionId;
}

function setSessionCookie(res, sessionId) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(
      sessionId
    )}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor(
      SESSION_MAX_AGE / 1000
    )}`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  );
}

// =====================================================
// PKCE HELPERS
// =====================================================

function createCodeVerifier() {
  return crypto
    .randomBytes(64)
    .toString("base64url");
}

function createCodeChallenge(
  codeVerifier
) {
  return crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
}

function createState() {
  return crypto
    .randomBytes(32)
    .toString("hex");
}

// =====================================================
// HEALTH CHECK
// =====================================================

app.get(
  "/health",
  (req, res) => {
    res.json({
      status: "ok",
      app:
        "Domynice Higher & Lower Bot",
      oauth:
        "Deriv OAuth 2.0 + PKCE",
      environment:
        process.env.NODE_ENV ||
        "production"
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
      const codeVerifier =
        createCodeVerifier();

      const codeChallenge =
        createCodeChallenge(
          codeVerifier
        );

      const state =
        createState();

      // Create temporary OAuth session.
      const sessionId =
        createSession({
          oauth: {
            state,
            codeVerifier,
            createdAt:
              Date.now()
          }
        });

      setSessionCookie(
        res,
        sessionId
      );

      const authUrl =
        new URL(
          DERIV_AUTH_URL
        );

      authUrl.searchParams.set(
        "response_type",
        "code"
      );

      authUrl.searchParams.set(
        "client_id",
        DERIV_CLIENT_ID
      );

      authUrl.searchParams.set(
        "redirect_uri",
        REDIRECT_URI
      );

      authUrl.searchParams.set(
        "scope",
        DERIV_SCOPE
      );

      authUrl.searchParams.set(
        "state",
        state
      );

      authUrl.searchParams.set(
        "code_challenge",
        codeChallenge
      );

      authUrl.searchParams.set(
        "code_challenge_method",
        "S256"
      );

      console.log(
        "Starting Deriv OAuth login"
      );

      res.redirect(
        authUrl.toString()
      );
    } catch (error) {
      console.error(
        "OAuth login error:",
        error
      );

      res
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
//
// This uses the same OAuth flow but requests the
// Deriv registration screen.
//
// Partner attribution values are read from Render
// environment variables so they are NOT hard-coded.
// =====================================================

app.get(
  "/api/deriv/signup",
  (req, res) => {
    try {
      const codeVerifier =
        createCodeVerifier();

      const codeChallenge =
        createCodeChallenge(
          codeVerifier
        );

      const state =
        createState();

      const sessionId =
        createSession({
          oauth: {
            state,
            codeVerifier,
            createdAt:
              Date.now()
          }
        });

      setSessionCookie(
        res,
        sessionId
      );

      const authUrl =
        new URL(
          DERIV_AUTH_URL
        );

      authUrl.searchParams.set(
        "response_type",
        "code"
      );

      authUrl.searchParams.set(
        "client_id",
        DERIV_CLIENT_ID
      );

      authUrl.searchParams.set(
        "redirect_uri",
        REDIRECT_URI
      );

      authUrl.searchParams.set(
        "scope",
        DERIV_SCOPE
      );

      authUrl.searchParams.set(
        "state",
        state
      );

      authUrl.searchParams.set(
        "code_challenge",
        codeChallenge
      );

      authUrl.searchParams.set(
        "code_challenge_method",
        "S256"
      );

      // Force Deriv registration screen.
      authUrl.searchParams.set(
        "prompt",
        "registration"
      );

      // Optional partner attribution.
      if (
        process.env.DERIV_TRACKING_TOKEN
      ) {
        authUrl.searchParams.set(
          process.env
            .DERIV_TRACKING_PARAMETER ||
            "t",
          process.env
            .DERIV_TRACKING_TOKEN
        );
      }

      if (
        process.env.DERIV_UTM_CAMPAIGN
      ) {
        authUrl.searchParams.set(
          "utm_campaign",
          process.env
            .DERIV_UTM_CAMPAIGN
        );
      }

      if (
        process.env.DERIV_UTM_MEDIUM
      ) {
        authUrl.searchParams.set(
          "utm_medium",
          process.env
            .DERIV_UTM_MEDIUM
        );
      }

      if (
        process.env.DERIV_UTM_SOURCE
      ) {
        authUrl.searchParams.set(
          "utm_source",
          process.env
            .DERIV_UTM_SOURCE
        );
      }

      console.log(
        "Starting Deriv OAuth registration"
      );

      res.redirect(
        authUrl.toString()
      );
    } catch (error) {
      console.error(
        "OAuth signup error:",
        error
      );

      res
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

      // User cancelled or Deriv returned an error.
      if (error) {
        console.error(
          "Deriv OAuth error:",
          error,
          error_description || ""
        );

        return res.redirect(
          "/?deriv_error=" +
            encodeURIComponent(
              error_description ||
                error
            )
        );
      }

      if (!code || !state) {
        return res
          .status(400)
          .send(
            "Missing OAuth code or state."
          );
      }

      const session =
        getSession(req);

      if (
        !session ||
        !session.oauth
      ) {
        return res
          .status(400)
          .send(
            "OAuth session expired. Please start Login / Sign Up again."
          );
      }

      // =================================================
      // STATE VALIDATION
      // =================================================

      if (
        session.oauth.state !==
        state
      ) {
        console.error(
          "OAuth state mismatch"
        );

        sessions.delete(
          session.id
        );

        clearSessionCookie(res);

        return res
          .status(400)
          .send(
            "OAuth security validation failed. Please try again."
          );
      }

      // =================================================
      // TOKEN EXCHANGE
      // =================================================

      const tokenResponse =
        await fetch(
          DERIV_TOKEN_URL,
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

                code_verifier:
                  session.oauth
                    .codeVerifier,

                redirect_uri:
                  REDIRECT_URI
              }).toString()
          }
        );

      const tokenData =
        await tokenResponse.json();

      if (
        !tokenResponse.ok ||
        !tokenData.access_token
      ) {
        console.error(
          "Deriv token exchange failed:",
          tokenData
        );

        sessions.delete(
          session.id
        );

        clearSessionCookie(res);

        return res
          .status(502)
          .send(
            "Deriv authorization failed. Please try Login / Sign Up again."
          );
      }

      // =================================================
      // GET USER'S DERIV ACCOUNTS
      // =================================================

      const accountsResponse =
        await fetch(
          `${DERIV_API_BASE}/trading/v1/options/accounts`,
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${tokenData.access_token}`,

              "Content-Type":
                "application/json"
            }
          }
        );

      const accountsData =
        await accountsResponse.json();

      if (
        !accountsResponse.ok
      ) {
        console.error(
          "Unable to retrieve Deriv accounts:",
          accountsData
        );

        sessions.delete(
          session.id
        );

        clearSessionCookie(res);

        return res
          .status(502)
          .send(
            "Deriv login succeeded, but the account information could not be retrieved."
          );
      }

      // =================================================
      // FIND DEMO / REAL ACCOUNTS
      // =================================================

      const accounts =
        Array.isArray(
          accountsData.data
        )
          ? accountsData.data
          : [];

      const demoAccounts =
        accounts.filter(
          (account) =>
            account.account_type ===
            "demo"
        );

      const realAccounts =
        accounts.filter(
          (account) =>
            account.account_type ===
            "real"
        );

      // Prefer demo as the initial account.
      const primaryAccount =
        demoAccounts[0] ||
        realAccounts[0] ||
        accounts[0] ||
        null;

      // =================================================
      // SAVE AUTHENTICATED SESSION
      // =================================================

      const authenticatedSession =
        {
          accessToken:
            tokenData.access_token,

          tokenType:
            tokenData.token_type ||
            "Bearer",

          expiresIn:
            tokenData.expires_in ||
            null,

          authenticatedAt:
            Date.now(),

          accountId:
            primaryAccount?.account_id ||
            null,

          accountType:
            primaryAccount?.account_type ||
            null,

          accounts,

          demoAccounts,

          realAccounts,

          oauth: undefined
        };

      sessions.set(
        session.id,
        authenticatedSession
      );

      console.log(
        "Deriv OAuth successful:",
        primaryAccount?.account_id ||
          "account not available"
      );

      // Return to the public platform.
      return res.redirect(
        "/?deriv_connected=1"
      );
    } catch (error) {
      console.error(
        "OAuth callback error:",
        error
      );

      return res
        .status(500)
        .send(
          "An error occurred while completing Deriv Login / Sign Up."
        );
    }
  }
);

// =====================================================
// GET AUTHENTICATED DERIV SESSION
// =====================================================

app.get(
  "/api/deriv-session",
  (req, res) => {
    const session =
      getSession(req);

    if (
      !session ||
      !session.accessToken
    ) {
      return res
        .status(401)
        .json({
          connected: false,
          error:
            "No authenticated Deriv session"
        });
    }

    const expiresAt =
      session.expiresIn
        ? session.authenticatedAt +
          session.expiresIn *
            1000
        : null;

    if (
      expiresAt &&
      Date.now() >= expiresAt
    ) {
      sessions.delete(
        session.id
      );

      clearSessionCookie(res);

      return res
        .status(401)
        .json({
          connected: false,
          error:
            "Deriv session expired"
        });
    }

    // IMPORTANT:
    // The OAuth access token is intentionally
    // NOT returned to the browser.
    return res.json({
      connected: true,

      account_id:
        session.accountId,

      account_type:
        session.accountType,

      accounts:
        session.accounts || [],

      demo_accounts:
        session.demoAccounts || [],

      real_accounts:
        session.realAccounts || []
    });
  }
);

// =====================================================
// GET ACCOUNT INFORMATION
// =====================================================

app.get(
  "/api/deriv-accounts",
  async (req, res) => {
    const session =
      getSession(req);

    if (
      !session ||
      !session.accessToken
    ) {
      return res
        .status(401)
        .json({
          error:
            "Not connected to Deriv"
        });
    }

    try {
      const response =
        await fetch(
          `${DERIV_API_BASE}/trading/v1/options/accounts`,
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${session.accessToken}`,

              "Content-Type":
                "application/json"
            }
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        return res
          .status(response.status)
          .json(data);
      }

      return res.json(
        data
      );
    } catch (error) {
      console.error(
        "Account request failed:",
        error
      );

      return res
        .status(502)
        .json({
          error:
            "Unable to retrieve Deriv account information."
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
    const cookies =
      parseCookies(req);

    const sessionId =
      cookies[SESSION_COOKIE];

    if (sessionId) {
      sessions.delete(
        sessionId
      );
    }

    clearSessionCookie(res);

    return res.json({
      success: true,
      connected: false
    });
  }
);

// Also allow browser navigation to logout.
app.get(
  "/api/deriv/logout",
  (req, res) => {
    const cookies =
      parseCookies(req);

    const sessionId =
      cookies[SESSION_COOKIE];

    if (sessionId) {
      sessions.delete(
        sessionId
      );
    }

    clearSessionCookie(res);

    res.redirect("/");
  }
);

// =====================================================
// CATCH COMMON CALLBACK PATH
// =====================================================

app.get(
  "/oauth/callback",
  (req, res) => {
    const query =
      new URLSearchParams(
        req.query
      ).toString();

    res.redirect(
      `/callback${
        query
          ? "?" + query
          : ""
      }`
    );
  }
);

// =====================================================
// FRONTEND FALLBACK
// =====================================================

app.get(
  "*",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "index.html"
      )
    );
  }
);

// =====================================================
// START SERVER
// =====================================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      "================================================="
    );

    console.log(
      "Domynice Higher & Lower Bot"
    );

    console.log(
      "Public Deriv Platform"
    );

    console.log(
      `Server running on port ${PORT}`
    );

    console.log(
      `OAuth redirect: ${REDIRECT_URI}`
    );

    console.log(
      `Deriv Client ID: ${DERIV_CLIENT_ID}`
    );

    console.log(
      "OAuth: Authorization Code + PKCE"
    );

    console.log(
      "================================================="
    );
  }
);
