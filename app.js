
function updateStatus(message) {
  const status = document.getElementById("status");

  if (status) {
    status.textContent = message;
  }
}

// =====================================================
// START DERIV LOGIN
// =====================================================

function connectDeriv() {
  updateStatus("Preparing Deriv Login...");

  window.location.href = "/api/deriv/login";
}

// =====================================================
// GET AUTHENTICATED DERIV SESSION
// =====================================================

async function loadDerivSession() {
  try {
    updateStatus("Connecting to Deriv...");

    const response = await fetch(
      "/api/deriv-session",
      {
        method: "GET",
        credentials: "include"
      }
    );

    const result = await response.json();

    if (!response.ok || !result.connected) {
      throw new Error(
        result.error ||
        "No authenticated Deriv session"
      );
    }

    // Save the authenticated information
    // for the existing Script.js WebSocket code.
    sessionStorage.setItem(
      "deriv_access_token",
      result.access_token
    );

    sessionStorage.setItem(
      "deriv_account_id",
      result.account_id
    );

    if (result.account_type) {
      sessionStorage.setItem(
        "deriv_account_type",
        result.account_type
      );
    }

    console.log(
      "Deriv account ID:",
      result.account_id
    );

    console.log(
      "Deriv account type:",
      result.account_type
    );

    updateStatus(
      `Connected to Deriv — ${result.account_id}`
    );

    // Tell Script.js to establish
    // the authenticated WebSocket connection.
    if (
      window.DomyniceDeriv &&
      typeof window.DomyniceDeriv.connect ===
        "function"
    ) {
      await window.DomyniceDeriv.connect(
        result.account_id
      );
    }

    // Remove OAuth query parameter.
    window.history.replaceState(
      {},
      document.title,
      "/"
    );

  } catch (error) {
    console.error(
      "Deriv session error:",
      error
    );

    sessionStorage.removeItem(
      "deriv_access_token"
    );

    sessionStorage.removeItem(
      "deriv_account_id"
    );

    sessionStorage.removeItem(
      "deriv_account_type"
    );

    updateStatus(
      "Deriv connection failed"
    );
  }
}

// =====================================================
// CHECK EXISTING SESSION
// =====================================================

async function checkExistingDerivSession() {
  const existingToken =
    sessionStorage.getItem(
      "deriv_access_token"
    );

  const existingAccountId =
    sessionStorage.getItem(
      "deriv_account_id"
    );

  // If we already have both values,
  // reconnect directly.
  if (
    existingToken &&
    existingAccountId
  ) {
    updateStatus(
      `Connected to Deriv — ${existingAccountId}`
    );

    if (
      window.DomyniceDeriv &&
      typeof window.DomyniceDeriv.connect ===
        "function"
    ) {
      await window.DomyniceDeriv.connect(
        existingAccountId
      );
    }

    return;
  }

  // Otherwise ask the server whether
  // the browser has an authenticated session.
  const url =
    new URL(window.location.href);

  if (
    url.searchParams.get(
      "deriv_connected"
    ) === "1"
  ) {
    await loadDerivSession();
  }
}

// =====================================================
// PAGE START
// =====================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const button =
      document.getElementById(
        "connectDeriv"
      );

    if (button) {
      button.type = "button";

      button.textContent =
        "Login / Sign Up";

      button.onclick =
        connectDeriv;
    }

    checkExistingDerivSession();
  }
);

// Make login function available globally.
window.connectDeriv =
  connectDeriv;
