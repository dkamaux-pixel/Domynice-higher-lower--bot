
import express from "express";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// =====================================================
// DOMYNICE DERIV CONFIGURATION
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

const DERIV_ACCOUNTS_URL =
  "https://api.derivws.com/trading/v1/options/accounts";

// =====================================================
// EXPRESS
// =====================================================

app.use(express.json());
app.use(express.static(__dirname));

// OAuth login sessions
const oauthSessions = new Map();

// Authenticated browser sessions
const userSessions = new Map();

// =====================================================
// HELPERS
// =====================================================

function generateRandomString(bytes = 32) {
  return crypto
    .randomBytes(bytes)
    .toString("base64url");
}

function createCodeChallenge(codeVerifier) {
  return crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
}

function getCookies(req) {
  const cookieHeader = req.headers.cookie || "";
  const cookies = {};

  cookieHeader.split(";").forEach((cookie) => {
    const separator = cookie.indexOf("=");

    if (separator === -1) return;

    const name = cookie.slice(0, separator).trim();
    const value = cookie.slice(separator + 1).trim();

    cookies[name] = decodeURIComponent(value);
  });

  return cookies;
}

function setCookie(res, name, value, maxAge = 3600) {
  res.setHeader(
    "Set-Cookie",
    `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`
  );
}

function clearCookie(res, name) {
  res.setHeader(
    "Set-Cookie",
    `${name}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`
  );
}

// =====================================================
// HEALTH
// =====================================================

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    app: "Domynice Higher & Lower Bot"
  });
});

// =====================================================
// START DERIV LOGIN
// =====================================================

app.get("/api/deriv/login", (req, res) => {
  try {
    const state = generateRandomString(32);

    const codeVerifier =
      generateRandomString(48);

    const codeChallenge =
      createCodeChallenge(codeVerifier);

    oauthSessions.set(state, {
      codeVerifier,
      createdAt: Date.now()
    });

    // Remove expired OAuth sessions
    const now = Date.now();

    for (const [savedState, session] of oauthSessions) {
      if (
        now - session.createdAt >
        10 * 60 * 1000
      ) {
        oauthSessions.delete(savedState);
      }
    }

    setCookie(
      res,
      "deriv_oauth_state",
      state,
      600
    );

    const params = new URLSearchParams({
      response_type: "code",
      client_id: DERIV_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: "trade account_manage",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256"
    });

    const loginUrl =
      `${DERIV_AUTH_URL}?${params.toString()}`;

    console.log("Starting Deriv OAuth...");
    console.log("Client ID:", DERIV_CLIENT_ID);
    console.log("Redirect URI:", REDIRECT_URI);

    res.redirect(loginUrl);

  } catch (error) {
    console.error(
      "OAuth start error:",
      error
    );

    res.status(500).send(
      "Unable to start Deriv login."
    );
  }
});

// =====================================================
// DERIV OAUTH CALLBACK
// =====================================================

app.get("/callback", async (req, res) => {
  const {
    code,
    state,
    error,
    error_description
  } = req.query;

  if (error) {
    clearCookie(
      res,
      "deriv_oauth_state"
    );

    return res.status(400).send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Deriv Login</title>
</head>
<body>
<h2>Deriv login was not completed</h2>
<p>${String(error_description || error)}</p>
<p><a href="/">Return to Domynice Bot</a></p>
</body>
</html>
`);
  }

  if (!code || !state) {
    clearCookie(
      res,
      "deriv_oauth_state"
    );

    return res.status(400).send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Deriv Login</title>
</head>
<body>
<h2>Invalid Deriv callback</h2>
<p>Authorization code or state was missing.</p>
<p><a href="/">Return to Domynice Bot</a></p>
</body>
</html>
`);
  }

  const cookies = getCookies(req);

  const cookieState =
    cookies.deriv_oauth_state;

  if (
    !cookieState ||
    cookieState !== state
  ) {
    clearCookie(
      res,
      "deriv_oauth_state"
    );

    return res.status(400).send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Deriv Login</title>
</head>
<body>
<h2>Deriv login session could not be verified</h2>
<p>Please return to the bot and try Login / Sign Up again.</p>
<p><a href="/">Return to Domynice Bot</a></p>
</body>
</html>
`);
  }

  const oauthSession =
    oauthSessions.get(state);

  if (!oauthSession) {
    clearCookie(
      res,
      "deriv_oauth_state"
    );

    return res.status(400).send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Deriv Login</title>
</head>
<body>
<h2>Deriv login session expired</h2>
<p>Please return to the bot and try Login / Sign Up again.</p>
<p><a href="/">Return to Domynice Bot</a></p>
</body>
</html>
`);
  }

  try {

    // =================================================
    // STEP 1 — EXCHANGE AUTHORIZATION CODE
    // =================================================

    const tokenParams =
      new URLSearchParams({
        grant_type:
          "authorization_code",

        client_id:
          DERIV_CLIENT_ID,

        code:
          String(code),

        code_verifier:
          oauthSession.codeVerifier,

        redirect_uri:
          REDIRECT_URI
      });

    console.log(
      "Exchanging authorization code..."
    );

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
            tokenParams.toString()
        }
      );

    const tokenData =
      await tokenResponse.json();

    oauthSessions.delete(state);

    clearCookie(
      res,
      "deriv_oauth_state"
    );

    if (
      !tokenResponse.ok ||
      !tokenData.access_token
    ) {
      console.error(
        "Token exchange failed:",
        tokenData
      );

      return res.status(
        tokenResponse.status || 500
      ).send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Deriv Login</title>
</head>
<body>
<h2>Deriv connection failed</h2>
<p>${String(
  tokenData.error_description ||
  tokenData.error ||
  "Deriv did not return an access token."
)}</p>
<p><a href="/">Return to Domynice Bot</a></p>
</body>
</html>
`);
    }

    const accessToken =
      tokenData.access_token;

    console.log(
      "OAuth token received successfully."
    );

    // =================================================
    // STEP 2 — GET DERIV ACCOUNTS
    // =================================================

    console.log(
      "Requesting Deriv account information..."
    );

    const accountsResponse =
      await fetch(
        DERIV_ACCOUNTS_URL,
        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${accessToken}`
          }
        }
      );

    const accountsData =
      await accountsResponse.json();

    console.log(
      "Deriv accounts response:",
      JSON.stringify(accountsData)
    );

    if (
      !accountsResponse.ok
    ) {
      console.error(
        "Unable to retrieve Deriv accounts:",
        accountsData
      );

      return res.status(
        accountsResponse.status || 500
      ).send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Deriv Login</title>
</head>
<body>
<h2>Deriv account could not be retrieved</h2>
<p>${String(
  accountsData.errors?.[0]?.message ||
  "Unable to retrieve your Deriv account."
)}</p>
<p><a href="/">Return to Domynice Bot</a></p>
</body>
</html>
`);
    }

    // Deriv returns the accounts in data.
    const accounts =
      Array.isArray(accountsData.data)
        ? accountsData.data
        : accountsData.data
          ? [accountsData.data]
          : [];

    if (accounts.length === 0) {
      return res.status(404).send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Deriv Login</title>
</head>
<body>
<h2>No Deriv Options account found</h2>
<p>Your Deriv login succeeded, but no Options account was returned.</p>
<p><a href="/">Return to Domynice Bot</a></p>
</body>
</html>
`);
    }

    // Prefer an active demo account.
    // If no demo account exists, use the first active account.
    const selectedAccount =
      accounts.find(
        (account) =>
          account.status === "active" &&
          account.account_type === "demo"
      ) ||
      accounts.find(
        (account) =>
          account.status === "active"
      ) ||
      accounts[0];

    const accountId =
      selectedAccount.account_id;

    if (!accountId) {
      console.error(
        "Account ID missing from account response:",
        selectedAccount
      );

      return res.status(500).send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Deriv Login</title>
</head>
<body>
<h2>Deriv account ID was not returned</h2>
<p>Please try logging in again.</p>
<p><a href="/">Return to Domynice Bot</a></p>
</body>
</html>
`);
    }

    console.log(
      "Deriv account ID:",
      accountId
    );

    console.log(
      "Deriv account type:",
      selectedAccount.account_type
    );

    // =================================================
    // STEP 3 — CREATE SECURE SERVER SESSION
    // =================================================

    const sessionId =
      generateRandomString(48);

    userSessions.set(
      sessionId,
      {
        accessToken,
        accountId,
        accountType:
          selectedAccount.account_type,
        expiresAt:
          Date.now() +
          ((tokenData.expires_in || 3600) *
            1000)
      }
    );

    // Remove expired sessions
    const currentTime =
      Date.now();

    for (
      const [
        savedSessionId,
        session
      ] of userSessions
    ) {
      if (
        session.expiresAt &&
        session.expiresAt <
          currentTime
      ) {
        userSessions.delete(
          savedSessionId
        );
      }
    }

    setCookie(
      res,
      "domynice_session",
      sessionId,
      tokenData.expires_in || 3600
    );

    // =================================================
    // STEP 4 — RETURN TO BOT
    // =================================================

    console.log(
      "Domynice Deriv session created successfully."
    );

    return res.redirect(
      "/?deriv_connected=1"
    );

  } catch (error) {

    console.error(
      "OAuth callback error:",
      error
    );

    oauthSessions.delete(state);

    clearCookie(
      res,
      "deriv_oauth_state"
    );

    return res.status(500).send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Deriv Login</title>
</head>
<body>
<h2>Deriv connection failed</h2>
<p>Please return to the bot and try Login / Sign Up again.</p>
<p><a href="/">Return to Domynice Bot</a></p>
</body>
</html>
`);
  }
});

// =====================================================
// RETURN AUTHENTICATED DERIV SESSION
// =====================================================

app.get(
  "/api/deriv-session",
  (req, res) => {

    const cookies =
      getCookies(req);

    const sessionId =
      cookies.domynice_session;

    if (!sessionId) {
      return res.status(401).json({
        connected: false,
        error:
          "No authenticated Deriv session."
      });
    }

    const session =
      userSessions.get(sessionId);

    if (!session) {
      return res.status(401).json({
        connected: false,
        error:
          "Deriv session expired."
      });
    }

    if (
      session.expiresAt &&
      session.expiresAt <
        Date.now()
    ) {
      userSessions.delete(
        sessionId
      );

      clearCookie(
        res,
        "domynice_session"
      );

      return res.status(401).json({
        connected: false,
        error:
          "Deriv session expired."
      });
    }

    // Return the information the frontend needs.
    return res.json({
      connected: true,
      access_token:
        session.accessToken,
      account_id:
        session.accountId,
      account_type:
        session.accountType
    });
  }
);

// =====================================================
// LOGOUT
// =====================================================

app.get(
  "/api/deriv/logout",
  (req, res) => {

    const cookies =
      getCookies(req);

    const sessionId =
      cookies.domynice_session;

    if (sessionId) {
      userSessions.delete(
        sessionId
      );
    }

    clearCookie(
      res,
      "domynice_session"
    );

    res.redirect("/");
  }
);

// =====================================================
// OLD TOKEN ENDPOINT
// =====================================================

app.post(
  "/api/deriv-token",
  (req, res) => {
    res.status(400).json({
      error:
        "Use /api/deriv/login for Deriv OAuth login."
    });
  }
);

// =====================================================
// FRONTEND FALLBACK
// =====================================================

app.use(
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
      "Deriv Client ID:",
      DERIV_CLIENT_ID
    );

    console.log(
      "Redirect URI:",
      REDIRECT_URI
    );

    console.log(
      "===================================="
    );
  }
);
