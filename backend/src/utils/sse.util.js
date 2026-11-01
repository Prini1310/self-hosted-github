/**
 * sse.util.js
 * Helper functions for Server-Sent Events (SSE) responses.
 */

function initSSE(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();
}

function sendSSEEvent(res, eventName, data) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function closeSSE(res) {
  res.end();
}

module.exports = {
  initSSE,
  sendSSEEvent,
  sendSSE: sendSSEEvent, // Keep sendSSE alias for backward compatibility
  closeSSE
};
