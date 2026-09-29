const APP_ID = "34xmNA7aCdIQnbxlGEhIw";
const WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`;

let ws = null;

function connectDeriv() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log("Connected to Deriv");
    updateStatus("Connected to Deriv");
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log(data);
  };

  ws.onerror = () => {
    updateStatus("Deriv connection error");
  };

  ws.onclose = () => {
    updateStatus("Disconnected from Deriv");
  };
}

function updateStatus(message) {
  const status = document.getElementById("status");
  if (status) {
    status.textContent = message;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("connectDeriv");

  if (button) {
    button.addEventListener("click", connectDeriv);
  }
});
