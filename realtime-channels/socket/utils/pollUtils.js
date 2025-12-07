const pool = require("../config/db");
const logger = require("./logger");

/**
 * Create a new poll with options
 */
async function createPoll({ channelId, question, options, createdBy }) {
  try {
    await pool.query("BEGIN");

    // Insert poll
    const pollRes = await pool.query(
      `INSERT INTO "Poll" (question, "createdById") VALUES ($1, $2) RETURNING id`,
      [question, createdBy]
    );
    const pollId = pollRes.rows[0].id;

    // Insert poll options
    for (const opt of options) {
      await pool.query(
        `INSERT INTO "PollOption" (text, "pollId") VALUES ($1, $2)`,
        [opt, pollId]
      );
    }

    // Optionally insert a message pointing to this poll
    await pool.query(
      `INSERT INTO "Message" ("channelId", "senderId", "messageType", "pollId", content)
       VALUES ($1, $2, 'poll', $3, $4)`,
      [channelId, createdBy, pollId, question]
    );

    await pool.query("COMMIT");
    return pollId;
  } catch (err) {
    await pool.query("ROLLBACK");
    logger.error(`[PollUtils] Failed to create poll: ${err.message}`);
    throw err;
  }
}

module.exports = { createPoll };
