
js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(__dirname));

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    app: "Domynice Higher & Lower Bot"
  });
});

app.post("/api/deriv-token", async (req, res) => {
  try {
    const { code, code_verifier } = req.body || {};

    if (!code || !code_verifier) {
      return res.status(400).json({
        error: "Missing required OAuth parameters"
      });
    }

    const clientId = process.env.DERIV_CLIENT_ID;
    const redirectUri = process.env.DERIV_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      console.error("Missing Deriv OAuth environment variables");

      return res.status(500).json({
        error: "Deriv OAuth configuration is missing"
      });
    }

    const form = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code: code,
      code_verifier: code_verifier,
      redirect_uri: redirectUri
    });

    const response = await fetch(
      "https://auth.deriv.com/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: form.toString()
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Deriv token exchange failed:", data);

      return res.status(response.status).json({
        error: data.error || "Token exchange failed",
        error_description: data.error_description || ""
      });
    }

    return res.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
      token_type: data.token_type
    });
  } catch (error) {
    console.error("OAuth server error:", error);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Domynice Higher & Lower Bot running on port " + PORT);
});

