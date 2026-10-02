
// =====================================================
// MIDDLEWARE
// =====================================================

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true
  })
);

// Serve all frontend files.
app.use(
  express.static(__dirname)
);

// =====================================================
// EXPLICIT FRONTEND HOME
// =====================================================

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});
