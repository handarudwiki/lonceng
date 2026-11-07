import { getDb } from "@lonceng/db";
import { tick } from "@lonceng/core";

const INTERVAL_MS = 60_000;
const db = getDb();
let running = false;

async function run() {
  // A slow tick must not overlap the next one.
  if (running) return;
  running = true;
  try {
    console.log(new Date().toISOString(), JSON.stringify(await tick(db)));
  } finally {
    running = false;
  }
}

console.log("Worker Lonceng berjalan");
void run();
setInterval(run, INTERVAL_MS);
