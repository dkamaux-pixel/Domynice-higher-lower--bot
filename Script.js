
let ws = null;
let authorized = false;
let currentSymbol = "R_10";
let currentAccountId = null;

function updateStatus(message) {
  const status = document.getElementById("status");

  if (status) {
    status.textContent = message;
  }
}

function updateTickDisplay(price) {
  const tickElement =
    document.getElementById("currentPrice") ||
    document.getElementById("price");

  if (tickElement) {
    tickElement.textContent = price;
  }
}

function getSelectedMarket() {
  const market =
    document.getElementById("market") ||
    document.getElementById("marketSelect");

  return market?.value || "R_10";
}

async function getAuthenticatedWebSocketUrl(accountId) {
  const accessToken =
    sessionStorage.getItem("deriv_access_token");

  if (!accessToken) {
    throw new Error("No Deriv access token found");
  }

  if (!accountId) {
    throw new Error("No Deriv account ID found");
  }

  const response = await fetch(
    `https://api.derivws.com/trading/v1/options/accounts/${encodeURIComponent(accountId)}/otp`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  const data = await response.json();

  if (!response.ok || !data.data?.url) {
    console.error("OTP request failed:", data);

    throw new Error(
      data.errors?.[0]?.message ||
      "Unable to create authenticated Deriv connection"
    );
  }

  return data.data.url;
}

function subscribeToTicks() {
  if (!ws || ws.readyState !== WebSocket.OPEN || !authorized) {
    return;
  }

  currentSymbol = getSelectedMarket();

  ws.send(
    JSON.stringify({
      ticks: currentSymbol,
      subscribe: 1
    })
  );

  console.log("Subscribed to ticks:", currentSymbol);
}

async function connectAuthenticatedDeriv(accountId) {
  try {
    const accessToken =
      sessionStorage.getItem("deriv_access_token");

    if (!accessToken) {
      updateStatus("Login to Deriv first");
      return;
    }

    if (!accountId) {
      accountId =
        sessionStorage.getItem("deriv_account_id");
    }

    if (!accountId) {
      updateStatus("Deriv account ID not found");
      return;
    }

    currentAccountId = accountId;

    if (ws && ws.readyState === WebSocket.OPEN) {
      subscribeToTicks();
      return;
    }

    updateStatus("Connecting to Deriv...");

    const wsUrl =
      await getAuthenticatedWebSocketUrl(accountId);

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("Authenticated Deriv WebSocket connected");

      authorized = true;

      updateStatus("Deriv account connected");

      subscribeToTicks();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        console.log("Deriv:", data);

        if (data.error) {
          console.error(
            "Deriv API error:",
            data.error
          );

          updateStatus(
            data.error.message ||
            "Deriv API error"
          );

          return;
        }

        if (data.msg_type === "tick") {
          const price = data.tick.quote;

          updateTickDisplay(price);

          console.log(
            `${data.tick.symbol}: ${price}`
          );
        }
      } catch (error) {
        console.error(
          "Invalid Deriv WebSocket message:",
          error
        );
      }
    };

    ws.onerror = (error) => {
      console.error(
        "Deriv WebSocket error:",
        error
      );

      authorized = false;
      updateStatus("Deriv connection error");
    };

    ws.onclose = () => {
      console.log(
        "Deriv WebSocket closed"
      );

      authorized = false;
      ws = null;
    };
  } catch (error) {
    console.error(
      "Deriv connection error:",
      error
    );

    authorized = false;
    ws = null;

    updateStatus(
      error.message ||
      "Unable to connect to Deriv"
    );
  }
}

document.addEventListener(
  "DOMContentLoaded",
  () => {
    const accessToken =
      sessionStorage.getItem(
        "deriv_access_token"
      );

    const accountId =
      sessionStorage.getItem(
        "deriv_account_id"
      );

    if (accessToken && accountId) {
      connectAuthenticatedDeriv(accountId);
    }
  }
);

window.DomyniceDeriv = {
  connect: connectAuthenticatedDeriv,

  subscribeToTicks,

  getWebSocket: () => ws,

  getCurrentSymbol: () =>
    currentSymbol,

  getCurrentAccountId: () =>
    currentAccountId
};
