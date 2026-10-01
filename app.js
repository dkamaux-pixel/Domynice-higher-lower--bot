
// Domynice Higher/Lower Bot
// Deriv OAuth 2.0 + PKCE
// Complete replacement for app.js

const DERIV_CLIENT_ID = "34xmNA7aCdIQnbxlGEhIw";

const REDIRECT_URI =
  "https://domynice-higher-lower-bot.onrender.com/callback";

const DERIV_AUTH_URL = "https://auth.deriv.com/oauth2/auth";

const OAUTH_SCOPE = "trade account_manage";

const REFERRAL_TOKEN = "MWDDQWN6R8TY";

const $ = (id) => document.getElementById(id);

function setStatus(message, isError = false) {
  const status =
    $("status") ||
    $("connectionStatus") ||
    $("message") ||
    $("loginStatus");

  if (status) {
    status.textContent = message;
    status.style.color = isError ? "#ef4444" : "";
  }

  console.log(message);
}

function randomString(length = 64) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  return Array.from(array, (value) => chars[value % chars.length]).join("");
}

async function createCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);

  const digest = await crypto.subtle.digest("SHA-256", data);

  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function getButton(...ids) {
  for (const id of ids) {
    const button = $(id);
    if (button) return button;
  }

  return null;
}

async function startDerivLogin(mode = "login") {
  try {
    setStatus("Preparing Deriv login...");

    if (!window.crypto || !window.crypto.subtle) {
      throw new Error(
        "Secure browser encryption is unavailable. Please open the app using HTTPS."
      );
    }

    const codeVerifier = randomString(64);
    const codeChallenge = await createCodeChallenge(codeVerifier);
    const state = randomString(32);

    // Save the values BEFORE leaving the app.
    sessionStorage.setItem("deriv_code_verifier", codeVerifier);
    sessionStorage.setItem("deriv_oauth_state", state);

    // Also save using the names used in Deriv's documentation.
    sessionStorage.setItem("code_verifier", codeVerifier);
    sessionStorage.setItem("oauth_state", state);

    const authUrl = new URL(DERIV_AUTH_URL);

    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", DERIV_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("scope", OAUTH_SCOPE);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    // Sign Up uses Deriv's required registration prompt.
    if (mode === "signup") {
      authUrl.searchParams.set("prompt", "registration");

      // Affiliate attribution.
      authUrl.searchParams.set("t", REFERRAL_TOKEN);
    }

    console.log("Deriv OAuth URL:", authUrl.toString());

    window.location.assign(authUrl.toString());
  } catch (error) {
    console.error("Deriv login error:", error);

    setStatus(
      "Unable to prepare Deriv login: " +
        (error?.message || "Unknown error"),
      true
    );
  }
}

async function handleOAuthCallback() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  // Not a callback request.
  if (!code && !error) {
    return false;
  }

  if (error) {
    setStatus(
      "Deriv login was not completed: " +
        (errorDescription || error),
      true
    );

    return true;
  }

  if (!returnedState) {
    setStatus("Deriv callback error: missing OAuth state.", true);
    return true;
  }

  const savedState =
    sessionStorage.getItem("deriv_oauth_state") ||
    sessionStorage.getItem("oauth_state");

  if (!savedState || returnedState !== savedState) {
    setStatus(
      "Deriv callback security check failed. Please start Login / Sign Up again.",
      true
    );

    return true;
  }

  const codeVerifier =
    sessionStorage.getItem("deriv_code_verifier") ||
    sessionStorage.getItem("code_verifier");

  if (!codeVerifier) {
    setStatus(
      "Deriv callback error: PKCE verifier was lost. Please start Login / Sign Up again.",
      true
    );

    return true;
  }

  try {
    setStatus("Completing Deriv login...");

    const response = await fetch("/api/deriv/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
        redirect_uri: REDIRECT_URI,
        client_id: DERIV_CLIENT_ID
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error_description ||
          data.error ||
          `Token exchange failed (${response.status})`
      );
    }

    if (!data.access_token) {
      throw new Error("Deriv did not return an access token.");
    }

    // Store token locally for this browser session.
    sessionStorage.setItem("deriv_access_token", data.access_token);

    if (data.expires_in) {
      sessionStorage.setItem(
        "deriv_token_expires_in",
        String(data.expires_in)
      );
    }

    // Remove one-time OAuth values.
    sessionStorage.removeItem("deriv_code_verifier");
    sessionStorage.removeItem("deriv_oauth_state");
    sessionStorage.removeItem("code_verifier");
    sessionStorage.removeItem("oauth_state");

    setStatus("Connected to Deriv successfully.");

    // Remove OAuth parameters from the visible URL.
    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );

    updateConnectionUI(true);

    return true;
  } catch (error) {
    console.error("OAuth callback error:", error);

    setStatus(
      "Deriv connection failed: " +
        (error?.message || "Unknown error"),
      true
    );

    return true;
  }
}

function updateConnectionUI(connected) {
  const loginButton = getButton(
    "loginButton",
    "connectButton",
    "connectDeriv",
    "loginSignupButton"
  );

  if (!loginButton) return;

  if (connected) {
    loginButton.textContent = "Connected to Deriv";
    loginButton.disabled = true;
  } else {
    loginButton.textContent = "Login / Sign Up";
    loginButton.disabled = false;
  }
}

function setupLoginButtons() {
  const loginButton = getButton(
    "loginButton",
    "connectButton",
    "connectDeriv",
    "loginSignupButton"
  );

  if (loginButton) {
    loginButton.addEventListener("click", () => {
      startDerivLogin("login");
    });
  }

  const signupButton = getButton(
    "signupButton",
    "signUpButton",
    "createAccountButton"
  );

  if (signupButton) {
    signupButton.addEventListener("click", () => {
      startDerivLogin("signup");
    });
  }
}

function setupTradingButtons() {
  const higherButton = getButton(
    "higherButton",
    "higherBtn"
  );

  const lowerButton = getButton(
    "lowerButton",
    "lowerBtn"
  );

  if (higherButton) {
    higherButton.addEventListener("click", () => {
      setStatus(
        "Higher selected. Connect your Deriv account before trading."
      );
    });
  }

  if (lowerButton) {
    lowerButton.addEventListener("click", () => {
      setStatus(
        "Lower selected. Connect your Deriv account before trading."
      );
    });
  }
}

async function initializeApp() {
  console.log("Domynice Higher/Lower Bot starting...");

  setupLoginButtons();
  setupTradingButtons();

  const callbackHandled = await handleOAuthCallback();

  if (!callbackHandled) {
    const token = sessionStorage.getItem("deriv_access_token");

    if (token) {
      updateConnectionUI(true);
      setStatus("Connected to Deriv.");
    } else {
      updateConnectionUI(false);
      setStatus("Ready. Login / Sign Up with Deriv.");
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}
