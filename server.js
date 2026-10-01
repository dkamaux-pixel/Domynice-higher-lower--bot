
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
  "34xmNA7aCdIQnbxlGEhIw";

const REDIRECT_URI =
  "https://domynice-higher-lower-bot.onrender.com/callback";

const DERIV_AUTH_URL =
  "https://auth.deriv.com/oauth2/auth";

const DERIV_TOKEN_URL =
  "https://auth.deriv.com/oauth2/token";

// =====================================================
// EXPRESS CONFIGURATION
// =====================================================

app.use(express.json());
app.use(express.static(__dirname));

// OAuth sessions stored temporarily in memory.
const oauthSessions = new Map();

// =====================================================
// SECURITY HELPERS
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

function setStateCookie(res, state) {
  res.setHeader(
    "Set-Cookie",
    `deriv_oauth_state=${encodeURIComponent(
      state
    )}; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax`
  );
}

function clearStateCookie(res) {
  res.setHeader(
    "Set-Cookie",
    "deriv_oauth_state=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax"
  );
}

function getCookies(req) {
  const cookieHeader =
    req.headers.cookie || "";

  const cookies = {};

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

// =====================================================
// HEALTH CHECK
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

app.get(
  "/api/deriv/login",
  (req, res) => {
    try {
      // Generate OAuth state.
      const state =
        generateRandomString(32);

      // Generate PKCE verifier.
      const codeVerifier =
        generateRandomString(48);

      // Generate PKCE challenge.
      const codeChallenge =
        createCodeChallenge(
          codeVerifier
        );

      // Store the OAuth information
      // on the server.
      oauthSessions.set(state, {
        codeVerifier,
        createdAt: Date.now()
      });

      // Remove old sessions.
      const now = Date.now();

      for (
        const [
          savedState,
          session
        ] of oauthSessions
      ) {
        if (
          now -
            session.createdAt >
          10 * 60 * 1000
        ) {
          oauthSessions.delete(
            savedState
          );
        }
      }

      // Save state in secure cookie.
      setStateCookie(
        res,
        state
      );

      // Build Deriv OAuth URL.
      const params =
        new URLSearchParams({
          response_type: "code",
          client_id:
            DERIV_CLIENT_ID,
          redirect_uri:
            REDIRECT_URI,
          scope:
            "trade account_manage",
          state,
          code_challenge:
            codeChallenge,
          code_challenge_method:
            "S256"
        });

      const loginUrl =
        `${DERIV_AUTH_URL}?${params.toString()}`;

      console.log(
        "Starting Deriv OAuth login..."
      );

      console.log(
        "Deriv App ID:",
        DERIV_CLIENT_ID
      );

      console.log(
        "Redirect URI:",
        REDIRECT_URI
      );

      res.redirect(
        loginUrl
      );
    } catch (error) {
      console.error(
        "OAuth start error:",
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
    // Deriv returned an error
    // -----------------------------------------------

    if (error) {
      clearStateCookie(res);

      return res
        .status(400)
        .send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >
  <title>Deriv Login</title>
</head>
<body>
  <h2>Deriv login was not completed</h2>
  <p>${String(
    error_description || error
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
    // Check callback parameters
    // -----------------------------------------------

    if (!code || !state) {
      clearStateCookie(res);

      return res
        .status(400)
        .send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >
  <title>Deriv Login</title>
</head>
<body>
  <h2>Invalid Deriv callback</h2>
  <p>
    The authorization code or OAuth state was missing.
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
    // Read state cookie
    // -----------------------------------------------

    const cookies =
      getCookies(req);

    const cookieState =
      cookies.deriv_oauth_state;

    // -----------------------------------------------
    // Verify OAuth state
    // -----------------------------------------------

    if (
      !cookieState ||
      cookieState !== state
    ) {
      clearStateCookie(res);

      return res
        .status(400)
        .send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >
  <title>Deriv Login</title>
</head>
<body>
  <h2>Deriv login session could not be verified</h2>

  <p>
    Please return to the Domynice Bot and tap
    Login / Sign Up again.
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
    // Retrieve PKCE verifier
    // -----------------------------------------------

    const session =
      oauthSessions.get(
        state
      );

    if (!session) {
      clearStateCookie(res);

      return res
        .status(400)
        .send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >
  <title>Deriv Login</title>
</head>
<body>
  <h2>Deriv login session expired</h2>

  <p>
    Please return to the Domynice Bot and tap
    Login / Sign Up again.
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
      // ---------------------------------------------
      // Exchange authorization code for token
      // ---------------------------------------------

      const tokenParams =
        new URLSearchParams({
          grant_type:
            "authorization_code",

          client_id:
            DERIV_CLIENT_ID,

          code:
            String(code),

          code_verifier:
            session.codeVerifier,

          redirect_uri:
            REDIRECT_URI
        });

      console.log(
        "Exchanging Deriv authorization code..."
      );

      const response =
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

      const data =
        await response.json();

      // OAuth state is no longer needed.
      oauthSessions.delete(
        state
      );

      clearStateCookie(res);

      // ---------------------------------------------
      // Check token response
      // ---------------------------------------------

      if (
        !response.ok ||
        !data.access_token
      ) {
        console.error(
          "Deriv token exchange failed:",
          data
        );

        return res
          .status(
            response.status || 500
          )
          .send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >
  <title>Deriv Login</title>
</head>
<body>
  <h2>Deriv connection failed</h2>

  <p>${String(
    data.error_description ||
      data.error ||
      "Deriv did not return an access token."
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

      console.log(
        "Deriv OAuth authentication successful."
      );

      // ---------------------------------------------
      // Return to the Domynice frontend
      // ---------------------------------------------

      const accessToken =
        encodeURIComponent(
          data.access_token
        );

      const expiresIn =
        encodeURIComponent(
          String(
            data.expires_in || ""
          )
        );

      return res.redirect(
        `/?deriv_connected=1&access_token=${accessToken}&expires_in=${expiresIn}`
      );
    } catch (error) {
      console.error(
        "OAuth callback error:",
        error
      );

      oauthSessions.delete(
        state
      );

      clearStateCookie(res);

      return res
        .status(500)
        .send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >
  <title>Deriv Login</title>
</head>
<body>
  <h2>Deriv connection failed</h2>

  <p>
    Please return to the bot and try
    Login / Sign Up again.
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
// COMPATIBILITY ENDPOINT
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
      "Deriv App ID:",
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
