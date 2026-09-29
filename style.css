const DERIV_APP_ID = "34xmNA7aCdIQnbxlGEhIw";
const DERIV_WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`;

let socket;

function connectDeriv() {
  socket = new WebSocket(DERIV_WS_URL);

  socket.onopen = () => {
    console.log("Connected to Deriv");
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("Deriv:", data);
  };

  socket.onerror = (error) => {
    console.error("Deriv connection error:", error);
  };

  socket.onclose = () => {
    console.log("Disconnected from Deriv");
  };
}

function getDerivSocket() {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    connectDeriv();
  }
  return socket;
}

window.DerivBot = {
  connect: connectDeriv,
  socket: getDerivSocket,
  appId: DERIV_APP_ID
};
