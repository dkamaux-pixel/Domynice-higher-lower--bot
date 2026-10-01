
const DERIV_CLIENT_ID = "34qpgcq22ebRi5fTv1UsH";

const REDIRECT_URI =
  "https://domynice-higher-lower-bot.onrender.com/callback";

const PKCE_VERIFIER_KEY = "pkce_code_verifier";
const OAUTH_STATE_KEY = "oauth_state";

function updateStatus(message) {
  const status = document.getElementById("status");

  if (status) {
    status.textContent = message;
  }
}

function generateCodeVerifier() {
  const bytes = crypto.getRandomValues(new Uint8Array(64));

  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

  return Array.from(bytes)
    .map((value) => characters[value % characters.length])
    .join("");
}

function base64UrlEncode(bytes) {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function createPkceChallenge(codeVerifier) {
  const data = new TextEncoder().encode(codeVerifier);
  const hash = await crypto.subtle.digest("SHA-256", data);

  return base64UrlEncode(new Uint8Array(hash));
}

function generateState() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function connectDeriv() {
  try {
    updateStatus("Preparing Deriv Login...");

    const codeVerifier = generateCodeVerifier();
    const codeChallenge =
      await createPkceChallenge(codeVerifier);

    const state = generateState();

    sessionStorage.setItem(
      PKCE_VERIFIER_KEY,
      codeVerifier
    );

    sessionStorage.setItem(
      OAUTH_STATE_KEY,
      state
    );

    const params = new URLSearchParams({
      response_type: "code",
      client_id: DERIV_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: "trade account_manage",
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256"
    });

    const loginUrl =
      "https://auth.deriv.com/oauth2/auth?" +
      params.toString();

    console.log("Opening Deriv OAuth:", loginUrl);

    window.location.assign(loginUrl);
  } catch (error) {
    console.error("Deriv login error:", error);
    updateStatus("Unable to start Deriv Login");
  }
}

async function handleCallback() {
  const url = new URL(window.location.href);

  const code =
    url.searchParams.get("code");

  const returnedState =
    url.searchParams.get("state");

  const error =
    url.searchParams.get("error");

  if (error) {
    updateStatus(
      "Deriv login failed: " +
      (url.searchParams.get("error_description") || error)
    );

    return;
  }

  if (!code) {
    return;
  }

  const savedState =
    sessionStorage.getItem(OAUTH_STATE_KEY);

  const codeVerifier =
    sessionStorage.getItem(PKCE_VERIFIER_KEY);

  if (!savedState || !codeVerifier) {
    updateStatus(
      "Login session expired. Please try again."
    );

    return;
  }

  if (returnedState !== savedState) {
    sessionStorage.removeItem(PKCE_VERIFIER_KEY);
    sessionStorage.removeItem(OAUTH_STATE_KEY);

    updateStatus("Security verification failed");

    return;
  }

  updateStatus(
    "Deriv authorization received..."
  );

  try {
    const response = await fetch(
      "/api/deriv-token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          code: code,
          code_verifier: codeVerifier
        })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.access_token) {
      throw new Error(
        result.error ||
        "Unable to exchange authorization code"
      );
    }

    sessionStorage.removeItem(
      PKCE_VERIFIER_KEY
    );

    sessionStorage.removeItem(
      OAUTH_STATE_KEY
    );

    sessionStorage.setItem(
      "deriv_access_token",
      result.access_token
    );

    updateStatus(
      "Deriv account connected"
    );

    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );

    console.log(
      "Deriv OAuth completed successfully"
    );

    if (
      window.DomyniceDeriv &&
      typeof window.DomyniceDeriv.connect === "function"
    ) {
      window.DomyniceDeriv.connect();
    }
  } catch (error) {
    console.error(
      "Token exchange error:",
      error
    );

    sessionStorage.removeItem(
      PKCE_VERIFIER_KEY
    );

    sessionStorage.removeItem(
      OAUTH_STATE_KEY
    );

    updateStatus(
      "Deriv connection failed"
    );
  }
}

function setupLoginButton() {
  const button =
    document.getElementById("connectDeriv");

  if (!button) {
    console.error(
      "Login button not found"
    );

    return;
  }

  button.type = "button";
  button.textContent = "Login / Sign Up";

  button.onclick = connectDeriv;

  console.log(
    "Deriv Login button ready"
  );
}

document.addEventListener(
  "DOMContentLoaded",
  () => {
    setupLoginButton();

    if (
      window.location.pathname === "/callback"
    ) {
      handleCallback();
    }
  }
);

window.connectDeriv = connectDeriv;
