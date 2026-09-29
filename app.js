const DERIV_APP_ID = "34xmNA7aCdIQnbxlGEhIw";
const REDIRECT_URI =
  "https://domynice-higher-lower--bot.netlify.app/callback";

function updateStatus(message) {
  const status = document.getElementById("status");

  if (status) {
    status.textContent = message;
  }
}

function connectDeriv() {
  updateStatus("Opening Deriv Login...");

  const authUrl =
    "https://oauth.deriv.com/oauth2/authorize" +
    "?app_id=" +
    encodeURIComponent(DERIV_APP_ID) +
    "&redirect_uri=" +
    encodeURIComponent(REDIRECT_URI) +
    "&scope=" +
    encodeURIComponent("trade");

  window.location.href = authUrl;
}

document.addEventListener("DOMContentLoaded", function () {
  const button = document.getElementById("connectDeriv");

  if (button) {
    button.textContent = "Login / Sign Up";
    button.addEventListener("click", connectDeriv);
  } else {
    console.error("Login button not found");
  }

  const currentUrl = new URL(window.location.href);

  if (currentUrl.pathname === "/callback") {
    updateStatus("Deriv authorization received. Processing...");
    console.log(
      "Deriv callback:",
      Object.fromEntries(currentUrl.searchParams.entries())
    );
  }
});
