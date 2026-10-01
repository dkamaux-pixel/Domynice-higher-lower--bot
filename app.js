
// Domynice Higher/Lower Bot
// Deriv OAuth 2.0 + PKCE
// Frontend

const DERIV_CLIENT_ID =
  "34xmNA7aCdIQnbxlGEhIw";

const REDIRECT_URI =
  "https://domynice-higher-lower-bot.onrender.com/callback";

const $ = (id) =>
  document.getElementById(id);

function updateStatus(
  message,
  isError = false
) {
  const status =
    $("status") ||
    $("connectionStatus") ||
    $("message") ||
    $("loginStatus");

  if (status) {
    status.textContent = message;

    if (isError) {
      status.style.color = "#ef4444";
    } else {
      status.style.color = "";
    }
  }

  console.log(message);
}

function getLoginButton() {
  return (
    $("connectDeriv") ||
    $("loginButton") ||
    $("connectButton") ||
    $("loginSignupButton")
  );
}

function setupLoginButton() {
  const button = getLoginButton();

  if (!button) {
    console.error(
      "Deriv Login button not found."
    );
    return;
  }

  button.type = "button";
  button.textContent = "Login / Sign Up";

  button.onclick = () => {
    updateStatus(
      "Preparing Deriv login..."
    );

    // The server now generates and stores
    // the OAuth state and PKCE verifier.
    window.location.assign(
      "/api/deriv/login"
    );
  };
}

function handleSuccessfulConnection() {
  const url = new URL(
    window.location.href
  );

  const connected =
    url.searchParams.get(
      "deriv_connected"
    );

  const accessToken =
    url.searchParams.get(
      "access_token"
    );

  const expiresIn =
    url.searchParams.get(
      "expires_in"
    );

  if (
    connected !== "1" ||
    !accessToken
  ) {
    return false;
  }

  try {
    sessionStorage.setItem(
      "deriv_access_token",
      accessToken
    );

    if (expiresIn) {
      sessionStorage.setItem(
        "deriv_token_expires_in",
        expiresIn
      );
    }

    updateStatus(
      "Deriv account connected successfully."
    );

    const button =
      getLoginButton();

    if (button) {
      button.textContent =
        "Connected to Deriv";

      button.disabled = true;
    }

    // Remove the token from the visible URL.
    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );

    if (
      window.DomyniceDeriv &&
      typeof window.DomyniceDeriv.connect ===
        "function"
    ) {
      window.DomyniceDeriv.connect();
    }

    return true;
  } catch (error) {
    console.error(
      "Connection handling error:",
      error
    );

    updateStatus(
      "Deriv connection could not be completed.",
      true
    );

    return false;
  }
}

function checkExistingConnection() {
  const token =
    sessionStorage.getItem(
      "deriv_access_token"
    );

  const button =
    getLoginButton();

  if (token) {
    updateStatus(
      "Connected to Deriv."
    );

    if (button) {
      button.textContent =
        "Connected to Deriv";

      button.disabled = true;
    }
  } else {
    updateStatus(
      "Ready. Login / Sign Up with Deriv."
    );
  }
}

function setupTradingButtons() {
  const higher =
    $("higherButton") ||
    $("higherBtn");

  const lower =
    $("lowerButton") ||
    $("lowerBtn");

  if (higher) {
    higher.addEventListener(
      "click",
      () => {
        const token =
          sessionStorage.getItem(
            "deriv_access_token"
          );

        if (!token) {
          updateStatus(
            "Please Login / Sign Up with Deriv first.",
            true
          );
          return;
        }

        updateStatus(
          "Higher selected."
        );
      }
    );
  }

  if (lower) {
    lower.addEventListener(
      "click",
      () => {
        const token =
          sessionStorage.getItem(
            "deriv_access_token"
          );

        if (!token) {
          updateStatus(
            "Please Login / Sign Up with Deriv first.",
            true
          );
          return;
        }

        updateStatus(
          "Lower selected."
        );
      }
    );
  }
}

function initializeApp() {
  console.log(
    "Domynice Higher/Lower Bot starting..."
  );

  setupLoginButton();
  setupTradingButtons();

  const connected =
    handleSuccessfulConnection();

  if (!connected) {
    checkExistingConnection();
  }
}

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializeApp
  );
} else {
  initializeApp();
    }
