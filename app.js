const APP_ID = "34xmNA7aCdIQnbxlGEhIw";
const WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`;

let socket = null;

function updateStatus(message) {
  const status = document.getElementById("status");
  if (status) {
    status.textContent = message;
  }
}

function connectDeriv() {
  updateStatus("Connecting to Deriv...");

  if (socket) {
    socket.close();
    socket = null;
  }

  try {
    socket = new WebSocket(WS_URL);

    socket.onopen = function () {
      console.log("Deriv WebSocket connected");
      updateStatus("Connected to Deriv");

      socket.send(
        JSON.stringify({
          active_symbols: "brief",
          product_type: "basic"
        })
      );
    };

    socket.onmessage = function (event) {
      try {
        const data = JSON.parse(event.data);
        console.log("Deriv response:", data);

        if (data.error) {
          console.error("Deriv API error:", data.error);
          updateStatus(`Deriv error: ${data.error.message || "API error"}`);
          return;
        }

        if (data.msg_type === "active_symbols") {
          updateStatus("Connected to Deriv");
          console.log("Markets loaded:", data.active_symbols);
        }
      } catch (error) {
        console.error("Invalid Deriv response:", error);
      }
    };

    socket.onerror = function (error) {
      console.error("Deriv WebSocket error:", error);
      updateStatus("Deriv connection error");
    };

    socket.onclose = function (event) {
      console.log(
        "Deriv WebSocket closed:",
        event.code,
        event.reason || "No reason provided"
      );

      if (event.code !== 1000) {
        updateStatus(`Disconnected from Deriv (${event.code})`);
      } else {
        updateStatus("Disconnected from Deriv");
      }

      socket = null;
    };
  } catch (error) {
    console.error("Failed to create WebSocket:", error);
    updateStatus("Unable to connect to Deriv");
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const button = document.getElementById("connectDeriv");

  if (button) {
    button.addEventListener("click", connectDeriv);
  } else {
    console.error("Connect Deriv button not found");
  }
});
