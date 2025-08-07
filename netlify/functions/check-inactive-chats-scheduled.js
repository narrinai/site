const { schedule } = require('@netlify/functions');

// Import the check-inactive-chats handler directly
const checkInactiveChats = require('./check-inactive-chats');

// Runs every 4 hours
exports.handler = schedule('0 */4 * * *', checkInactiveChats.handler);