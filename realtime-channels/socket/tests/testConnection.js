// testDbConnection.js
const pool = require("../config/db");

async function test() {
  console.log("Testing PostgreSQL connection...");

  try {
    // Query to list all tables in the 'public' schema
    const res = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public';
    `);

    if (res.rows.length === 0) {
      console.log("No tables found in the 'public' schema.");
    } else {
      console.log("Tables in the 'public' schema:");
      console.table(res.rows);
    }
  } catch (err) {
    console.error("Database error:", err.message);
  } finally {
    await pool.end();
    console.log("Connection closed.");
  }
}

test();
