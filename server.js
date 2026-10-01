import express from "express";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// =====================================================
// DOMYNICE DERIV OAUTH CONFIGURATION
// =====================================================

// Confirmed OAuth Client ID
const DERIV_CLIENT_ID =
  "34xmNA7aCdIQnbxlGEhIw";

// This must exactly match the URI registered
// in the Deriv OAuth application.
const REDIRECT_URI =
  "https://domynice-higher-lower-bot.onrender.com/callback";

// Current Deriv OAuth 2.0 endpoints
const DERIV_AUTH_URL =
  "https://auth.deriv.com/oauth2/auth";

const DERIV_TOKEN_URL =
  "https://auth.deriv.com/oauth2/token";

// Current Deriv Options API
const DERIV_ACCOUNTS_URL =
  "https://api.derivws.com/trading/v1/options/accounts";

// =====================================================
// EXPRESS
// =====================================================

app.use(express.json());
app.use(express.static(__dirname));

// =====================================================
// SESSION STORAGE
// =====================================================

const oauthSessions = new Map();
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
  const cookieHeader =
    req.headers.cookie || "";

  const cookies = {};

  if (!cookieHeader) {
    return cookies;
  }

  cookieHeader
    .split(";")
    .forEach((cookie) => {
      const separator =
        cookie.indexOf("=");

      if (separator === -1) {
        return;
      }

      const name =
        cookie
          .slice(0, separator)
          .trim();

      const value =
        cookie
          .slice(separator + 1)
          .trim();

      cookies[name] =
        decodeURIComponent(value);
    });

  return cookies;
}

function setCookie(
  res,
  name,
  value,
  maxAge = 3600
) {
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

function cleanupExpiredSessions() {
  const now = Date.now();

  for (
    const [state, session]
    of oauthSessions
  ) {
    if (
      now - session.createdAt >
      10 * 60 * 1000
    ) {
      oauthSessions.delete(state);
    }
  }

  for (
    const [sessionId, session]
    of userSessions
  ) {
    if (
      session.expiresAt &&
      session.expiresAt < now
    ) {
      userSessions.delete(sessionId);
    }
  }
}

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    app: "Domynice Higher & Lower Bot",
    oauth: "Deriv OAuth 2.0",
    redirect_uri: REDIRECT_URI
  });
});

// =====================================================
// START DERIV LOGIN
// =====================================================

app.get(
  "/api/deriv/login",
  (req, res) => {
    try {
      cleanupExpiredSessions();

      // -----------------------------------------------
      // Generate OAuth state
      // -----------------------------------------------

      const state =
        generateRandomString(32);

      // -----------------------------------------------
      // Generate PKCE verifier
      // -----------------------------------------------

      const codeVerifier =
        generateRandomString(48);

      // -----------------------------------------------
      // Generate PKCE challenge
      // -----------------------------------------------

      const codeChallenge =
        createCodeChallenge(
          codeVerifier
        );

      // -----------------------------------------------
      // Save OAuth session
      // -----------------------------------------------

      oauthSessions.set(
        state,
        {
          codeVerifier,
          createdAt: Date.now()
        }
      );

      // -----------------------------------------------
      // Save state in secure cookie
      // -----------------------------------------------

      setCookie(
        res,
        "deriv_oauth_state",
        state,
        600
      );

      // -----------------------------------------------
      // Build Deriv OAuth URL
      // -----------------------------------------------

      const authUrl =
        new URL(DERIV_AUTH_URL);

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

      // Only request the scope required
      // to read Options accounts and trade.
      authUrl.searchParams.set(
        "scope",
        "trade"
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

      const loginUrl =
        authUrl.toString();

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
        "Authorization URL:",
        loginUrl
      );

      console.log(
        "===================================="
      );

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
  }
);

// =====================================================
// DERIV OAUTH CALLBACK
// =====================================================

app.get(
  "/callback",
  async (req, res) => {

    const {
      code,
      state,
      error,
      error_description
    } = req.query;

    // -----------------------------------------------
    // Deriv returned an OAuth error
    // -----------------------------------------------

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
<p>${String(
  error_description ||
  error
)}</p>
<p>
<a href="/">
Return to Domynice Bot
</a>
</p>
</body>
</html>
`);
    }

    // -----------------------------------------------
    // Check authorization code and state
    // -----------------------------------------------

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
<p>
Authorization code or state was missing.
</p>
<p>
<a href="/">
Return to Domynice Bot
</a>
</p>
</body>
</html>
`);
    }

    // -----------------------------------------------
    // Verify OAuth state cookie
    // -----------------------------------------------

    const cookies =
      getCookies(req);

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
<p>
Please return to the bot and try Login / Sign Up again.
</p>
<p>
<a href="/">
Return to Domynice Bot
</a>
</p>
</body>
</html>
`);
    }

    // -----------------------------------------------
    // Find saved OAuth session
    // -----------------------------------------------

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
<p>
Please return to the bot and try Login / Sign Up again.
</p>
<p>
<a href="/">
Return to Domynice Bot
</a>
</p>
</body>
</html>
`);
    }

    try {

      // =============================================
      // STEP 1
      // EXCHANGE AUTHORIZATION CODE FOR TOKEN
      // =============================================

      const tokenParams =
        new URLSearchParams();

      tokenParams.set(
        "grant_type",
        "authorization_code"
      );

      tokenParams.set(
        "client_id",
        DERIV_CLIENT_ID
      );

      tokenParams.set(
        "code",
        String(code)
      );

      tokenParams.set(
        "code_verifier",
        oauthSession.codeVerifier
      );

      tokenParams.set(
        "redirect_uri",
        REDIRECT_URI
      );

      console.log(
        "Exchanging Deriv authorization code..."
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

      const tokenText =
        await tokenResponse.text();

      let tokenData = {};

      try {
        tokenData =
          JSON.parse(tokenText);
      } catch {
        tokenData = {
          raw: tokenText
        };
      }

      // OAuth state has now been used.
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
          "Deriv token exchange failed:",
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

<p>
${String(
  tokenData.error_description ||
  tokenData.error ||
  "Deriv did not return an access token."
)}
</p>

<p>
<a href="/">
Return to Domynice Bot
</a>
</p>

</body>
</html>
`);
      }

      const accessToken =
        tokenData.access_token;

      console.log(
        "Deriv OAuth token received successfully."
      );

      // =============================================
      // STEP 2
      // GET OPTIONS ACCOUNTS
      // =============================================

      console.log(
        "Requesting Deriv Options accounts..."
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

      const accountsText =
        await accountsResponse.text();

      let accountsData = {};

      try {
        accountsData =
          JSON.parse(accountsText);
      } catch {
        accountsData = {
          raw: accountsText
        };
      }

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

<p>
${String(
  accountsData.errors?.[0]?.message ||
  "Unable to retrieve your Deriv Options account."
)}
</p>

<p>
<a href="/">
Return to Domynice Bot
</a>
</p>

</body>
</html>
`);
      }

      // =============================================
      // STEP 3
      // NORMALIZE ACCOUNT RESPONSE
      // =============================================

      let accounts = [];

      if (
        Array.isArray(
          accountsData.data
        )
      ) {
        accounts =
          accountsData.data;
      } else if (
        accountsData.data &&
        typeof accountsData.data ===
          "object"
      ) {
        accounts = [
          accountsData.data
        ];
      }

      if (accounts.length === 0) {

        console.error(
          "No Options accounts returned."
        );

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

<p>
Your Deriv login succeeded, but no Options account was returned.
</p>

<p>
<a href="/">
Return to Domynice Bot
</a>
</p>

</body>
</html>
`);
      }

      // =============================================
      // STEP 4
      // SELECT ACCOUNT
      // =============================================

      const selectedAccount =
        accounts.find(
          (account) =>
            account.status ===
              "active" &&
            account.account_type ===
              "demo"
        ) ||
        accounts.find(
          (account) =>
            account.status ===
            "active"
        ) ||
        accounts[0];

      const accountId =
        selectedAccount.account_id;

      const accountType =
        selectedAccount.account_type ||
        "unknown";

      if (!accountId) {

        console.error(
          "No account_id returned:",
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

<p>
The Deriv login succeeded, but the account ID was missing.
</p>

<p>
<a href="/">
Return to Domynice Bot
</a>
</p>

</body>
</html>
`);
      }

      console.log(
        "===================================="
      );

      console.log(
        "Deriv account ID:",
        accountId
      );

      console.log(
        "Deriv account type:",
        accountType
      );

      console.log(
        "===================================="
      );

      // =============================================
      // STEP 5
      // CREATE BROWSER SESSION
      // =============================================

      const sessionId =
        generateRandomString(48);

      const expiresIn =
        Number(
          tokenData.expires_in
        ) || 3600;

      userSessions.set(
        sessionId,
        {
          accessToken,
          accountId,
          accountType,
          expiresAt:
            Date.now() +
            expiresIn * 1000
        }
      );

      cleanupExpiredSessions();

      setCookie(
        res,
        "domynice_session",
        sessionId,
        expiresIn
      );

      // =============================================
      // STEP 6
      // RETURN TO DOMYNICE BOT
      // =============================================

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

<p>
${String(
  error.message ||
  "Unexpected OAuth error."
)}
</p>

<p>
<a href="/">
Return to Domynice Bot
</a>
</p>

</body>
</html>
`);
    }
  }
);

// =====================================================
// RETURN DERIV SESSION TO FRONTEND
// =====================================================

app.get(
  "/api/deriv-session",
  (req, res) => {

    cleanupExpiredSessions();

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
      userSessions.get(
        sessionId
      );

    if (!session) {
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

    return res.status(400).json({
      error:
        "Use /api/deriv/login for Deriv OAuth 2.0."
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
      "Deriv OAuth Client ID:",
      DERIV_CLIENT_ID
    );

    console.log(
      "Deriv Redirect URI:",
      REDIRECT_URI
    );

    console.log(
      "Deriv OAuth Endpoint:",
      DERIV_AUTH_URL
    );

    console.log(
      "===================================="
    );
  }
);
