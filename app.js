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
  }

  socket = new WebSocket(WS_URL);

  socket.onopen = function () {
    console.log("Connected to Deriv");
    updateStatus("Connected to Deriv");

    socket.send(JSON.stringify({
      active_symbols: "brief",
      product_type: "basic"
    }));
  };

  socket.onmessage = function (event) {
    const data = JSON.parse(event.data);
    console.log("Deriv:", data);
  };

  socket.onerror = function (error) {
    console.error("Deriv WebSocket error:", error);
    updateStatus("Deriv connection error");
  };

  socket.onclose = function () {
    console.log("Disconnected from Deriv");
    updateStatus("Disconnected from Deriv");
  };
}

document.addEventListener("DOMContentLoaded", function () {
  const button = document.getElementById("connectDeriv");

  if (button) {
    button.addEventListener("click", connectDeriv);
  }
});
