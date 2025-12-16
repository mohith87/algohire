const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "video_forge",
  password: "root",
  port: 5432,
});

/* ---------- STORAGE ---------- */
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

/* ---------- UPLOAD ---------- */
app.post("/upload", upload.single("video"), async (req, res) => {
  const { format, resolution } = req.body;
  const file = req.file;

  const video = await pool.query(
    `
    INSERT INTO videos (original_name, stored_name)
    VALUES ($1, $2)
    RETURNING id
    `,
    [file.originalname, file.filename]
  );

  await pool.query(
    `
    INSERT INTO tasks (video_id, format, resolution, status)
    VALUES ($1, $2, $3, 'QUEUED')
    `,
    [video.rows[0].id, format, resolution]
  );

  res.json({ message: "Video uploaded and task queued" });
});

/* ---------- TASK LIST ---------- */
app.get("/tasks", async (req, res) => {
  const result = await pool.query(`
    SELECT 
      tasks.id,
      videos.original_name,
      tasks.status
    FROM tasks
    JOIN videos ON tasks.video_id = videos.id
    ORDER BY tasks.id DESC
  `);

  res.json(result.rows);
});

/* ---------- DOWNLOAD ---------- */
app.get("/download/:id", async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    "SELECT output_path FROM tasks WHERE id = $1",
    [id]
  );

  if (!result.rows.length) {
    return res.status(404).send("Output not found");
  }

  const filePath = path.join(__dirname, "outputs", result.rows[0].output_path);
  res.download(filePath);
});

/* ---------- DELETE ---------- */
app.delete("/tasks/:id", async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    "SELECT output_path FROM tasks WHERE id = $1",
    [id]
  );

  if (result.rows.length && result.rows[0].output_path) {
    const filePath = path.join(__dirname, "outputs", result.rows[0].output_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  await pool.query("DELETE FROM tasks WHERE id = $1", [id]);
  res.json({ message: "Deleted" });
});

app.listen(5000, () =>
  console.log("Server running on http://localhost:5000")
);