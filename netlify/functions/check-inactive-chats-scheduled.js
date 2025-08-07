const { schedule } = require('@netlify/functions');
const handler = require('./check-inactive-chats').handler;

// Runs every 4 hours
exports.handler = schedule('0 */4 * * *', handler);