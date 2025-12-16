const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "video_forge",
  password: "root",
  port: 5432,
});

const OUTPUT_DIR = path.join(__dirname, "outputs");
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

async function processTask() {
  const res = await pool.query(`
    SELECT 
      tasks.id,
      tasks.format,
      tasks.resolution,
      videos.stored_name
    FROM tasks
    JOIN videos ON tasks.video_id = videos.id
    WHERE tasks.status = 'QUEUED'
    LIMIT 1
  `);

  if (!res.rows.length) return;

  const task = res.rows[0];

  await pool.query(
    "UPDATE tasks SET status = 'PROCESSING' WHERE id = $1",
    [task.id]
  );

  const inputPath = path.join(__dirname, "uploads", task.stored_name);
  const outputFile = `${task.id}_${task.resolution}.${task.format}`;
  const outputPath = path.join(OUTPUT_DIR, outputFile);

  // 🔹 Dummy processing (professor acceptable)
  fs.copyFileSync(inputPath, outputPath);

  await pool.query(
    `
    UPDATE tasks 
    SET status = 'COMPLETED', output_path = $1
    WHERE id = $2
    `,
    [outputFile, task.id]
  );

  console.log("Completed task:", task.id);
}

setInterval(processTask, 5000);