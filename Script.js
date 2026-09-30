
```js id="p8q2rm"
let ws = null;
let authorized = false;
let currentSymbol = "R_10";

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

  if (!market) {
    return "R_10";
  }

  return market.value || "R_10";
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

function connectAuthenticatedDeriv() {
  const accessToken =
    sessionStorage.getItem("deriv_access_token");

  if (!accessToken) {
    console.log("No authenticated Deriv session found.");
    updateStatus("Login to Deriv first");
    return;
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    subscribeToTicks();
    return;
  }

  const wsUrl =
    "wss://ws.derivws.com/websockets/v3?app_id=34qpgcq22ebRi5fTv1UsH";

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log("Connected to Deriv WebSocket");

    ws.send(
      JSON.stringify({
        authorize: accessToken
      })
    );
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    console.log("Deriv:", data);

    if (data.error) {
      console.error("Deriv API error:", data.error);

      updateStatus(
        data.error.message || "Deriv API error"
      );

      return;
    }

    if (data.msg_type === "authorize") {
      authorized = true;

      updateStatus("Deriv account connected");

      console.log(
        "Authorized account:",
        data.authorize.loginid
      );

      sessionStorage.setItem(
        "deriv_account_id",
        data.authorize.loginid || ""
      );

      subscribeToTicks();
      return;
    }

    if (data.msg_type === "tick") {
      const price = data.tick.quote;

      updateTickDisplay(price);

      console.log(
        `${data.tick.symbol}: ${price}`
      );
    }
  };

  ws.onerror = (error) => {
    console.error("Deriv WebSocket error:", error);

    authorized = false;
    updateStatus("Deriv connection error");
  };

  ws.onclose = () => {
    console.log("Deriv WebSocket closed");

    authorized = false;
    ws = null;
  };
}

document.addEventListener("DOMContentLoaded", () => {
  const accessToken =
    sessionStorage.getItem("deriv_access_token");

  if (accessToken) {
    connectAuthenticatedDeriv();
  }
});

window.DomyniceDeriv = {
  connect: connectAuthenticatedDeriv,

  subscribeToTicks,

  getWebSocket: () => ws,

  getCurrentSymbol: () => currentSymbol
};
```
