```js
let ws = null;

function updateStatus(message) {
  const status = document.getElementById("status");

  if (status) {
    status.textContent = message;
  }
}

function connectAuthenticatedDeriv() {
  const accessToken = sessionStorage.getItem("deriv_access_token");

  if (!accessToken) {
    console.log("No authenticated Deriv session found.");
    return;
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
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
        data.error.message || "Deriv authorization failed"
      );

      return;
    }

    if (data.msg_type === "authorize") {
      updateStatus("Deriv account connected");

      console.log("Deriv account authorized:", data.authorize);

      sessionStorage.setItem(
        "deriv_account_id",
        data.authorize.loginid || ""
      );
    }
  };

  ws.onerror = (error) => {
    console.error("Deriv WebSocket error:", error);
    updateStatus("Deriv connection error");
  };

  ws.onclose = () => {
    console.log("Deriv WebSocket closed");
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
```

