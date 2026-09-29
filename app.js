
const APP_ID = "34xmNA7aCdIQnbxlGEhIw";
const WS_URL = "wss://ws.binaryws.com/websockets/v3";

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

  socket = new WebSocket(WS_URL);

  socket.onopen = function () {
    console.log("Connected to Deriv");
    updateStatus("Connected to Deriv");

    socket.send(
      JSON.stringify({
        active_symbols: "brief",
        product_type: "basic",
        req_id: 1
      })
    );
  };

  socket.onmessage = function (event) {
    try {
      const data = JSON.parse(event.data);

      console.log("Deriv:", data);

      if (data.error) {
        console.error("Deriv error:", data.error);
        updateStatus("Deriv error: " + data.error.message);
        return;
      }

      if (data.msg_type === "active_symbols") {
        console.log("Markets loaded:", data.active_symbols);
        updateStatus("Connected to Deriv");
      }
    } catch (error) {
      console.error("Response error:", error);
    }
  };

  socket.onerror = function (error) {
    console.error("WebSocket error:", error);
    updateStatus("Deriv connection error");
  };

  socket.onclose = function (event) {
    console.log(
      "Disconnected from Deriv. Code:",
      event.code,
      "Reason:",
      event.reason
    );

    if (event.code === 1000) {
      updateStatus("Disconnected from Deriv");
    } else {
      updateStatus("Disconnected from Deriv (" + event.code + ")");
    }

    socket = null;
  };
}

document.addEventListener("DOMContentLoaded", function () {
  const button = document.getElementById("connectDeriv");

  if (button) {
    button.addEventListener("click", connectDeriv);
  } else {
    console.error("Connect Deriv button not found");
  }
});
