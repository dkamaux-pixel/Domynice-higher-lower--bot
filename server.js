
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

const DERIV_CLIENT_ID =
  "34xmNA7aCdIQnbxlGEhIw";

const REDIRECT_URI =
  "https://domynice-higher-lower-bot.onrender.com/callback";

// Deriv OAuth 2.0
const DERIV_AUTH_URL =
  "https://auth.deriv.com/oauth2/auth";

const DERIV_TOKEN_URL =
  "https://auth.deriv.com/oauth2/token";

// Deriv Options API
const DERIV_ACCOUNTS_URL =
  "https://api.derivws.com/trading/v1/options/accounts";

// =====================================================
// EXPRESS
// =====================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

      try {
        cookies[name] =
          decodeURIComponent(value);
      } catch {
        cookies[name] = value;
      }
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

function getUserSession(req) {
  const cookies =
    getCookies(req);

  const sessionId =
    cookies.domynice_session;

  if (!sessionId) {
    return null;
  }

  const session =
    userSessions.get(sessionId);

  if (!session) {
    return null;
  }

  if (
    session.expiresAt &&
    session.expiresAt < Date.now()
  ) {
    userSessions.delete(sessionId);
    return null;
  }

  return {
    sessionId,
    session
  };
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

      const state =
        generateRandomString(32);

      const codeVerifier =
        generateRandomString(48);

      const codeChallenge =
        createCodeChallenge(
          codeVerifier
        );

      oauthSessions.set(
        state,
        {
          codeVerifier,
          createdAt: Date.now()
        }
      );

      setCookie(
        res,
        "deriv_oauth_state",
        state,
        600
      );

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

      authUrl.searchParams.set(
        "scope",
        "trade account_manage"
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
        authUrl.toString()
      );

    } catch (error) {
      console.error(
        "OAuth start error:",
        error
      );

      return res.status(500).send(
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
    // OAUTH ERROR
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
<style>
body {
  font-family: Arial, sans-serif;
  background: #0f172a;
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  margin: 0;
}
.box {
  max-width: 420px;
  padding: 30px;
  background: #1e293b;
  border-radius: 16px;
  text-align: center;
}
a {
  color: #60a5fa;
}
</style>
</head>
<body>
<div class="box">
<h2>Deriv login was not completed</h2>
<p>${escapeHtml(
  error_description || error
)}</p>
<p>
<a href="/">Return to Domynice Bot</a>
</p>
</div>
</body>
</html>
`);
    }

    // -----------------------------------------------
    // VALIDATE CALLBACK
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
<title>Invalid Callback</title>
</head>
<body>
<h2>Invalid Deriv callback</h2>
<p>Authorization code or state was missing.</p>
<a href="/">Return to Domynice Bot</a>
</body>
</html>
`);
    }

    // -----------------------------------------------
    // VERIFY STATE COOKIE
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
<title>Security Error</title>
</head>
<body>
<h2>Deriv login session could not be verified</h2>
<p>Please return to the bot and try again.</p>
<a href="/">Return to Domynice Bot</a>
</body>
</html>
`);
    }

    // -----------------------------------------------
    // GET SAVED OAUTH SESSION
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
<title>Session Expired</title>
</head>
<body>
<h2>Deriv login session expired</h2>
<p>Please return to the bot and try again.</p>
<a href="/">Return to Domynice Bot</a>
</body>
</html>
`);
    }

    try {

      // =============================================
      // STEP 1
      // EXCHANGE CODE FOR TOKEN
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
<title>Deriv Login Failed</title>
</head>
<body>
<h2>Deriv connection failed</h2>
<p>${escapeHtml(
  tokenData.error_description ||
  tokenData.error ||
  "Deriv did not return an access token."
)}</p>
<a href="/">Return to Domynice Bot</a>
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
      // GET ALL OPTIONS ACCOUNTS
      // =============================================

      console.log(
        "Requesting Demo and Real Deriv accounts..."
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
<title>Accounts Error</title>
</head>
<body>
<h2>Deriv accounts could not be retrieved</h2>
<p>${escapeHtml(
  accountsData.errors?.[0]?.message ||
  accountsData.error?.message ||
  accountsData.error ||
  "Unable to retrieve your Deriv accounts."
)}</p>
<a href="/">Return to Domynice Bot</a>
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

      // Only keep accounts with IDs
      accounts =
        accounts.filter(
          (account) =>
            account &&
            account.account_id
        );

      if (
        accounts.length === 0
      ) {

        return res.status(404).send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>No Accounts</title>
</head>
<body>
<h2>No Deriv Options account found</h2>
<p>
Your Deriv login succeeded, but no Options account was returned.
</p>
<a href="/">Return to Domynice Bot</a>
</body>
</html>
`);
      }

      // =============================================
      // STEP 4
      // CREATE USER SESSION
      // =============================================

      const sessionId =
        generateRandomString(48);

      const expiresIn =
        Number(
          tokenData.expires_in
        ) || 3600;

      // Create a random selector token.
      // This prevents an arbitrary account-selection request
      // from being accepted without an authenticated session.
      const accountSelectionToken =
        generateRandomString(32);

      userSessions.set(
        sessionId,
        {
          accessToken,

          accounts,

          accountId: null,

          accountType: null,

          accountSelectionToken,

          expiresAt:
            Date.now() +
            expiresIn * 1000
        }
      );

      setCookie(
        res,
        "domynice_session",
        sessionId,
        expiresIn
      );

      console.log(
        "===================================="
      );

      console.log(
        "Deriv accounts found:",
        accounts.length
      );

      for (
        const account of accounts
      ) {
        console.log(
          "Account:",
          account.account_id,
          "Type:",
          account.account_type,
          "Status:",
          account.status
        );
      }

      console.log(
        "===================================="
      );

      // =============================================
      // STEP 5
      // SHOW DEMO / REAL SELECTOR
      // =============================================

      return res.redirect(
        "/account-select"
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
<title>Domynice Error</title>
</head>
<body>
<h2>Deriv connection failed</h2>
<p>${escapeHtml(
  error.message ||
  "Unexpected OAuth error."
)}</p>
<a href="/">Return to Domynice Bot</a>
</body>
</html>
`);
    }
  }
);

// =====================================================
// DEMO / REAL ACCOUNT SELECTOR PAGE
// =====================================================

app.get(
  "/account-select",
  (req, res) => {

    cleanupExpiredSessions();

    const user =
      getUserSession(req);

    if (!user) {
      return res.redirect("/");
    }

    const {
      session
    } = user;

    const accounts =
      Array.isArray(
        session.accounts
      )
        ? session.accounts
        : [];

    if (
      accounts.length === 0
    ) {
      return res.status(404).send(
        "No Deriv accounts available."
      );
    }

    const demoAccounts =
      accounts.filter(
        (account) =>
          String(
            account.account_type
          ).toLowerCase() ===
          "demo"
      );

    const realAccounts =
      accounts.filter(
        (account) =>
          String(
            account.account_type
          ).toLowerCase() ===
          "real"
      );

    function accountCard(
      account,
      type
    ) {

      const label =
        type === "demo"
          ? "Demo Account"
          : "Real Account";

      const balance =
        account.balance !==
        undefined
          ? `${account.balance} ${account.currency || "USD"}`
          : "Balance available in Deriv";

      const disabled =
        account.status &&
        account.status !== "active";

      return `
<form
  method="POST"
  action="/api/deriv/select-account"
  class="account-form"
>
  <input
    type="hidden"
    name="account_id"
    value="${escapeHtml(
      account.account_id
    )}"
  >

  <input
    type="hidden"
    name="selection_token"
    value="${escapeHtml(
      session.accountSelectionToken
    )}"
  >

  <button
    type="submit"
    class="account-button ${type}"
    ${disabled ? "disabled" : ""}
  >
    <span class="account-title">
      ${escapeHtml(label)}
    </span>

    <span class="account-id">
      ${escapeHtml(
        account.account_id
      )}
    </span>

    <span class="account-balance">
      ${escapeHtml(balance)}
    </span>

    <span class="account-status">
      ${escapeHtml(
        account.status || "unknown"
      )}
    </span>
  </button>
</form>
`;
    }

    const demoHtml =
      demoAccounts.length > 0
        ? demoAccounts
            .map((account) =>
              accountCard(
                account,
                "demo"
              )
            )
            .join("")
        : `
<div class="empty">
No Demo Options account was returned.
</div>
`;

    const realHtml =
      realAccounts.length > 0
        ? realAccounts
            .map((account) =>
              accountCard(
                account,
                "real"
              )
            )
            .join("")
        : `
<div class="empty">
No Real Options account was returned.
</div>
`;

    return res.send(`
<!DOCTYPE html>
<html>
<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>
Domynice - Select Deriv Account
</title>

<style>

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  font-family:
    Arial,
    Helvetica,
    sans-serif;

  background:
    linear-gradient(
      135deg,
      #020617,
      #0f172a,
      #111827
    );

  color: white;

  display: flex;
  justify-content: center;
  align-items: center;

  padding: 20px;
}

.container {
  width: 100%;
  max-width: 520px;
}

.logo {
  text-align: center;
  margin-bottom: 20px;
}

.logo h1 {
  margin: 0;
  font-size: 28px;
}

.logo p {
  margin-top: 8px;
  color: #94a3b8;
}

.panel {
  background: #111827;
  border: 1px solid #334155;
  border-radius: 20px;
  padding: 24px;
  box-shadow:
    0 20px 50px
    rgba(0,0,0,0.35);
}

.panel h2 {
  margin-top: 0;
  text-align: center;
}

.description {
  text-align: center;
  color: #94a3b8;
  line-height: 1.5;
  margin-bottom: 24px;
}

.section-title {
  margin: 20px 0 10px;
  font-size: 15px;
  color: #cbd5e1;
}

.account-form {
  margin-bottom: 12px;
}

.account-button {
  width: 100%;
  border: 1px solid #334155;
  border-radius: 14px;
  padding: 18px;
  cursor: pointer;
  color: white;
  text-align: left;
  background: #1e293b;
  transition: transform 0.15s,
              border-color 0.15s;
}

.account-button:hover {
  transform: translateY(-1px);
  border-color: #60a5fa;
}

.account-button.demo {
  border-left: 5px solid #22c55e;
}

.account-button.real {
  border-left: 5px solid #f59e0b;
}

.account-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.account-title {
  display: block;
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 7px;
}

.account-id {
  display: block;
  font-size: 13px;
  color: #cbd5e1;
  margin-bottom: 5px;
}

.account-balance {
  display: block;
  font-size: 14px;
  color: #94a3b8;
  margin-bottom: 5px;
}

.account-status {
  display: block;
  font-size: 12px;
  color: #64748b;
  text-transform: uppercase;
}

.empty {
  padding: 15px;
  border-radius: 12px;
  background: #0f172a;
  color: #94a3b8;
  margin-bottom: 15px;
}

.note {
  margin-top: 20px;
  padding: 14px;
  background: #0f172a;
  border-radius: 12px;
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.5;
}

.back {
  display: block;
  text-align: center;
  margin-top: 20px;
  color: #60a5fa;
  text-decoration: none;
}

</style>

</head>

<body>

<div class="container">

  <div class="logo">
    <h1>Domynice Higher & Lower Bot</h1>
    <p>Deriv trading platform</p>
  </div>

  <div class="panel">

    <h2>
      Select Trading Account
    </h2>

    <p class="description">
      Your Deriv account is connected.
      Choose which account the bot should use.
    </p>

    <div class="section-title">
      DEMO ACCOUNT
    </div>

    ${demoHtml}

    <div class="section-title">
      REAL ACCOUNT
    </div>

    ${realHtml}

    <div class="note">
      <strong>Important:</strong>
      Demo uses virtual funds.
      Real uses real-money funds.
      Check the selected account carefully
      before starting any trade.
    </div>

    <a
      class="back"
      href="/api/deriv/logout"
    >
      Cancel / Logout
    </a>

  </div>

</div>

</body>
</html>
`);
  }
);

// =====================================================
// SELECT DEMO / REAL ACCOUNT
// =====================================================

app.post(
  "/api/deriv/select-account",
  (req, res) => {

    cleanupExpiredSessions();

    const user =
      getUserSession(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        error:
          "Deriv session expired. Please login again."
      });
    }

    const {
      sessionId,
      session
    } = user;

    const {
      account_id,
      selection_token
    } = req.body;

    // -----------------------------------------------
    // VERIFY SELECTION TOKEN
    // -----------------------------------------------

    if (
      !selection_token ||
      selection_token !==
        session.accountSelectionToken
    ) {
      return res.status(403).send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Security Error</title>
</head>
<body>
<h2>Account selection could not be verified</h2>
<a href="/">Return to Domynice Bot</a>
</body>
</html>
`);
    }

    if (!account_id) {
      return res.status(400).send(
        "Account ID is required."
      );
    }

    // -----------------------------------------------
    // ONLY ALLOW AN ACCOUNT RETURNED BY DERIV
    // -----------------------------------------------

    const selectedAccount =
      session.accounts.find(
        (account) =>
          String(
            account.account_id
          ) === String(account_id)
      );

    if (!selectedAccount) {
      return res.status(403).send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invalid Account</title>
</head>
<body>
<h2>Invalid Deriv account</h2>
<p>
That account was not returned by your authenticated Deriv session.
</p>
<a href="/account-select">
Choose another account
</a>
</body>
</html>
`);
    }

    // -----------------------------------------------
    // ACCOUNT MUST BE ACTIVE
    // -----------------------------------------------

    if (
      selectedAccount.status &&
      selectedAccount.status !==
        "active"
    ) {
      return res.status(400).send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Account Not Active</title>
</head>
<body>
<h2>Account is not active</h2>
<p>
Please choose an active Demo or Real account.
</p>
<a href="/account-select">
Choose another account
</a>
</body>
</html>
`);
    }

    // -----------------------------------------------
    // SAVE SELECTED ACCOUNT
    // -----------------------------------------------

    session.accountId =
      selectedAccount.account_id;

    session.accountType =
      selectedAccount.account_type ||
      "unknown";

    session.selectedAccount =
      selectedAccount;

    // Prevent reuse of the selector token.
    session.accountSelectionToken =
      null;

    userSessions.set(
      sessionId,
      session
    );

    console.log(
      "===================================="
    );

    console.log(
      "Selected Deriv account:",
      selectedAccount.account_id
    );

    console.log(
      "Selected account type:",
      selectedAccount.account_type
    );

    console.log(
      "===================================="
    );

    // -----------------------------------------------
    // RETURN TO BOT
    // -----------------------------------------------

    return res.redirect(
      "/?deriv_connected=1"
    );
  }
);

// =====================================================
// RETURN AVAILABLE ACCOUNTS
// =====================================================

app.get(
  "/api/deriv-accounts",
  (req, res) => {

    cleanupExpiredSessions();

    const user =
      getUserSession(req);

    if (!user) {
      return res.status(401).json({
        connected: false
      });
    }

    const {
      session
    } = user;

    const accounts =
      Array.isArray(
        session.accounts
      )
        ? session.accounts.map(
            (account) => ({
              account_id:
                account.account_id,

              account_type:
                account.account_type,

              status:
                account.status,

              balance:
                account.balance,

              currency:
                account.currency,

              selected:
                account.account_id ===
                session.accountId
            })
          )
        : [];

    return res.json({
      connected: true,
      accounts
    });
  }
);

// =====================================================
// RETURN CURRENT DERIV SESSION
// =====================================================

app.get(
  "/api/deriv-session",
  (req, res) => {

    cleanupExpiredSessions();

    const user =
      getUserSession(req);

    if (!user) {

      return res.status(401).json({
        connected: false,
        error:
          "No authenticated Deriv session."
      });
    }

    const {
      session
    } = user;

    // Login succeeded but account has
    // not yet been selected.
    if (!session.accountId) {

      return res.json({
        connected: true,

        account_selected: false,

        account_id: null,

        account_type: null,

        accounts_available:
          Array.isArray(
            session.accounts
          )
            ? session.accounts.length
            : 0
      });
    }

    return res.json({
      connected: true,

      account_selected: true,

      account_id:
        session.accountId,

      account_type:
        session.accountType,

      // Do NOT send the access token
      // to the browser.
      expires_at:
        session.expiresAt
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

    return res.redirect("/");
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
      "===================================="
    );
  }
);
