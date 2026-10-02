
// =====================================================
// DOMYNICE HIGHER / LOWER BOT
// Deriv OAuth 2.0 + PKCE
// Express 5
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
// EXPRESS
// =====================================================

const app = express();

const PORT = process.env.PORT || 10000;

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
// DOMYNICE / DERIV CONFIGURATION
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

// Optional partner tracking token.
// Set this in Render only if you have the correct
// tracking token from your Deriv Partners dashboard.
const DERIV_PARTNER_TOKEN =
  process.env.DERIV_PARTNER_TOKEN || "";

// Optional partner campaign information.
const DERIV_UTM_CAMPAIGN =
  process.env.DERIV_UTM_CAMPAIGN || "domynice";

const DERIV_UTM_MEDIUM =
  process.env.DERIV_UTM_MEDIUM || "affiliate";

const DERIV_UTM_SOURCE =
  process.env.DERIV_UTM_SOURCE || "";

// =====================================================
// TEMPORARY SESSION STORAGE
// =====================================================
//
// This is suitable for the current OAuth testing stage.
//
// The authenticated user's Deriv access token stays
// on the server and is NEVER returned to the browser.
//
// Before large-scale public deployment, this should be
// moved to a persistent session/database system.
//

const sessions = new Map();

const oauthStates = new Map();

const SESSION_DURATION =
  60 * 60 * 1000;

// =====================================================
// HELPER: RANDOM STRING
// =====================================================

function randomString(bytes = 32) {
  return crypto
    .randomBytes(bytes)
    .toString("base64url");
}

// =====================================================
// HELPER: PKCE CODE CHALLENGE
// =====================================================

function createCodeChallenge(codeVerifier) {
  return crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
}

// =====================================================
// HELPER: SESSION COOKIE
// =====================================================

function createSessionCookie(sessionId) {
  return [
    `domynice_session=${sessionId}`,
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
// HELPER: READ COOKIE
// =====================================================

function getCookie(req, name) {
  const cookieHeader =
    req.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const cookies =
    cookieHeader.split(";");

  for (const cookie of cookies) {
    const [key, ...valueParts] =
      cookie.trim().split("=");

    if (key === name) {
      return decodeURIComponent(
        valueParts.join("=")
      );
    }
  }

  return null;
}

// =====================================================
// HELPER: GET CURRENT SESSION
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
// HELPER: DERIV API REQUEST
// =====================================================

async function derivRequest(
  endpoint,
  accessToken,
  options = {}
) {
  const headers = {
    Authorization:
      `Bearer ${accessToken}`,
    Accept:
      "application/json",
    ...(options.headers || {})
  };

  const response =
    await fetch(
      `${DERIV_API_BASE}${endpoint}`,
      {
        ...options,
        headers
      }
    );

  const text =
    await response.text();

  let data;

  try {
    data = text
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
      `Deriv API returned HTTP ${response.status}`;

    const error =
      new Error(message);

    error.status =
      response.status;

    error.deriv =
      data;

    throw error;
  }

  return data;
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
        "Domynice Higher/Lower Bot",
      oauth:
        "Deriv OAuth 2.0 + PKCE",
      express:
        "Express 5",
      timestamp:
        new Date().toISOString()
    });
  }
);

// =====================================================
// DERIV LOGIN
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
          state,
          codeVerifier,
          createdAt:
            Date.now(),
          mode:
            "login"
        }
      );

      const authorizationUrl =
        new URL(
          DERIV_AUTH_URL
        );

      authorizationUrl.searchParams.set(
        "response_type",
        "code"
      );

      authorizationUrl.searchParams.set(
        "client_id",
        DERIV_CLIENT_ID
      );

      authorizationUrl.searchParams.set(
        "redirect_uri",
        REDIRECT_URI
      );

      authorizationUrl.searchParams.set(
        "scope",
        DERIV_SCOPE
      );

      authorizationUrl.searchParams.set(
        "state",
        state
      );

      authorizationUrl.searchParams.set(
        "code_challenge",
        codeChallenge
      );

      authorizationUrl.searchParams.set(
        "code_challenge_method",
        "S256"
      );

      res.redirect(
        authorizationUrl.toString()
      );
    } catch (error) {
      console.error(
        "Deriv login error:",
        error
      );

      res.status(500).send(
        "Unable to start Deriv login."
      );
    }
  }
);

// =====================================================
// DERIV SIGN UP
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
          state,
          codeVerifier,
          createdAt:
            Date.now(),
          mode:
            "signup"
        }
      );

      const authorizationUrl =
        new URL(
          DERIV_AUTH_URL
        );

      authorizationUrl.searchParams.set(
        "response_type",
        "code"
      );

      authorizationUrl.searchParams.set(
        "client_id",
        DERIV_CLIENT_ID
      );

      authorizationUrl.searchParams.set(
        "redirect_uri",
        REDIRECT_URI
      );

      authorizationUrl.searchParams.set(
        "scope",
        DERIV_SCOPE
      );

      authorizationUrl.searchParams.set(
        "state",
        state
      );

      authorizationUrl.searchParams.set(
        "code_challenge",
        codeChallenge
      );

      authorizationUrl.searchParams.set(
        "code_challenge_method",
        "S256"
      );

      // Tell Deriv to show registration.
      authorizationUrl.searchParams.set(
        "prompt",
        "registration"
      );

      // Optional partner attribution.
      if (DERIV_PARTNER_TOKEN) {
        authorizationUrl.searchParams.set(
          "t",
          DERIV_PARTNER_TOKEN
        );
      }

      if (DERIV_UTM_CAMPAIGN) {
        authorizationUrl.searchParams.set(
          "utm_campaign",
          DERIV_UTM_CAMPAIGN
        );
      }

      if (DERIV_UTM_MEDIUM) {
        authorizationUrl.searchParams.set(
          "utm_medium",
          DERIV_UTM_MEDIUM
        );
      }

      if (DERIV_UTM_SOURCE) {
        authorizationUrl.searchParams.set(
          "utm_source",
          DERIV_UTM_SOURCE
        );
      }

      res.redirect(
        authorizationUrl.toString()
      );
    } catch (error) {
      console.error(
        "Deriv signup error:",
        error
      );

      res.status(500).send(
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

      // -------------------------------------------------
      // USER CANCELLED / DERIV ERROR
      // -------------------------------------------------

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

      // -------------------------------------------------
      // VALIDATE CODE + STATE
      // -------------------------------------------------

      if (!code || !state) {
        return res.status(400).send(
          "Missing OAuth code or state."
        );
      }

      const oauthState =
        oauthStates.get(state);

      if (!oauthState) {
        return res.status(400).send(
          "Invalid or expired OAuth state."
        );
      }

      // State can only be used once.
      oauthStates.delete(state);

      // State expiration check.
      if (
        Date.now() -
          oauthState.createdAt >
        10 * 60 * 1000
      ) {
        return res.status(400).send(
          "OAuth session expired. Please try again."
        );
      }

      // -------------------------------------------------
      // EXCHANGE AUTHORIZATION CODE
      // -------------------------------------------------

      const tokenBody =
        new URLSearchParams();

      tokenBody.set(
        "grant_type",
        "authorization_code"
      );

      tokenBody.set(
        "client_id",
        DERIV_CLIENT_ID
      );

      tokenBody.set(
        "code",
        code
      );

      tokenBody.set(
        "code_verifier",
        oauthState.codeVerifier
      );

      tokenBody.set(
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
              tokenBody.toString()
          }
        );

      const tokenText =
        await tokenResponse.text();

      let tokenData;

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

        return res.status(502).send(
          "Deriv authorization failed. Please try again."
        );
      }

      const accessToken =
        tokenData.access_token;

      if (!accessToken) {
        console.error(
          "No access token returned by Deriv:",
          tokenData
        );

        return res.status(502).send(
          "Deriv did not return an access token."
        );
      }

      // -------------------------------------------------
      // GET USER'S DERIV ACCOUNTS
      // -------------------------------------------------

      const accountsResponse =
        await derivRequest(
          "/trading/v1/options/accounts",
          accessToken
        );

      let accounts =
        accountsResponse?.data;

      if (!Array.isArray(accounts)) {
        accounts =
          accounts
            ? [accounts]
            : [];
      }

      // -------------------------------------------------
      // CREATE SERVER SESSION
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

          oauthMode:
            oauthState.mode
        }
      );

      // -------------------------------------------------
      // SECURE SESSION COOKIE
      // -------------------------------------------------

      res.setHeader(
        "Set-Cookie",
        createSessionCookie(
          sessionId
        )
      );

      // -------------------------------------------------
      // RETURN TO APP
      // -------------------------------------------------

      return res.redirect(
        "/?deriv_connected=1"
      );
    } catch (error) {
      console.error(
        "OAuth callback error:",
        error
      );

      return res.status(500).send(
        "Unable to complete Deriv login. Please try again."
      );
    }
  }
);

// =====================================================
// GET AUTHENTICATED DERIV SESSION
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

      const {
        data
      } = session;

      // Refresh account information.
      let accounts =
        data.accounts || [];

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

          data.accounts =
            accounts;
        } else if (
          latest?.data
        ) {
          accounts = [
            latest.data
          ];

          data.accounts =
            accounts;
        }
      } catch (error) {
        console.error(
          "Unable to refresh Deriv accounts:",
          error.message
        );
      }

      // Find demo and real accounts.
      const demoAccounts =
        accounts.filter(
          (account) =>
            account?.account_type ===
            "demo"
        );

      const realAccounts =
        accounts.filter(
          (account) =>
            account?.account_type ===
            "real"
        );

      const defaultAccount =
        realAccounts[0] ||
        demoAccounts[0] ||
        accounts[0] ||
        null;

      // IMPORTANT:
      // The access token is intentionally NOT
      // returned to the browser.
      return res.json({
        connected: true,

        account_id:
          defaultAccount?.account_id ||
          null,

        account_type:
          defaultAccount?.account_type ||
          null,

        currency:
          defaultAccount?.currency ||
          null,

        balance:
          defaultAccount?.balance ??
          null,

        accounts,

        demo_accounts:
          demoAccounts,

        real_accounts:
          realAccounts
      });
    } catch (error) {
      console.error(
        "Session error:",
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
// GET ALL USER ACCOUNTS
// =====================================================

app.get(
  "/api/deriv-accounts",
  async (req, res) => {
    try {
      const session =
        getSession(req);

      if (!session) {
        return res.status(401).json({
          connected: false,
          error:
            "Not connected to Deriv."
        });
      }

      const accountsResponse =
        await derivRequest(
          "/trading/v1/options/accounts",
          session.data.accessToken
        );

      let accounts =
        accountsResponse?.data;

      if (!Array.isArray(accounts)) {
        accounts =
          accounts
            ? [accounts]
            : [];
      }

      session.data.accounts =
        accounts;

      return res.json({
        connected: true,
        accounts
      });
    } catch (error) {
      console.error(
        "Accounts error:",
        error
      );

      return res.status(
        error.status || 500
      ).json({
        connected: false,
        error:
          error.message ||
          "Unable to retrieve Deriv accounts."
      });
    }
  }
);

// =====================================================
// LOGOUT
// =====================================================

app.get(
  "/api/deriv/logout",
  (req, res) => {
    const sessionId =
      getCookie(
        req,
        "domynice_session"
      );

    if (sessionId) {
      sessions.delete(
        sessionId
      );
    }

    res.setHeader(
      "Set-Cookie",
      [
        "domynice_session=",
        "Path=/",
        "HttpOnly",
        "Secure",
        "SameSite=Lax",
        "Max-Age=0"
      ].join("; ")
    );

    return res.json({
      success: true,
      connected: false
    });
  }
);

// =====================================================
// LEGACY CALLBACK COMPATIBILITY
// =====================================================

app.get(
  "/oauth/callback",
  (req, res) => {
    const query =
      new URLSearchParams(
        req.query
      ).toString();

    const target =
      query
        ? `/callback?${query}`
        : "/callback";

    return res.redirect(
      target
    );
  }
);

// =====================================================
// EXPRESS 5 FRONTEND FALLBACK
// =====================================================
//
// IMPORTANT:
// Express 5 does NOT support app.get("*").
// This syntax matches "/" and all other paths.
//

app.get(
  "/{*splat}",
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
// ERROR HANDLER
// =====================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "Unhandled server error:",
      error
    );

    if (res.headersSent) {
      return next(error);
    }

    return res.status(500).json({
      error:
        "Internal server error."
    });
  }
);

// =====================================================
// CLEAN EXPIRED OAUTH STATES
// =====================================================

setInterval(
  () => {
    const now =
      Date.now();

    for (
      const [
        state,
        data
      ] of oauthStates.entries()
    ) {
      if (
        now -
          data.createdAt >
        10 * 60 * 1000
      ) {
        oauthStates.delete(
          state
        );
      }
    }

    for (
      const [
        sessionId,
        session
      ] of sessions.entries()
    ) {
      if (
        now -
          session.createdAt >
        SESSION_DURATION
      ) {
        sessions.delete(
          sessionId
        );
      }
    }
  },
  60 * 1000
);

// =====================================================
// START SERVER
// =====================================================

app.listen(
  PORT,
  () => {
    console.log(
      "================================================="
    );

    console.log(
      "Domynice Higher/Lower Bot"
    );

    console.log(
      "Server started successfully"
    );

    console.log(
      `Port: ${PORT}`
    );

    console.log(
      `OAuth Client ID: ${DERIV_CLIENT_ID}`
    );

    console.log(
      `OAuth Redirect URI: ${REDIRECT_URI}`
    );

    console.log(
      "OAuth: Deriv OAuth 2.0 + PKCE"
    );

    console.log(
      "================================================="
    );
  }
);
