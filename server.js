import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// Serve the bot's frontend files
app.use(express.static(__dirname));

// Health check for Render
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    app: "Domynice Higher & Lower Bot"
  });
});

// Send the main app
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Domynice Higher & Lower Bot running on port ${PORT}`);
});
