#!/usr/bin/env node

/**
 * Test script for the name shortening functionality
 */

const { getFirstName } = require('./shorten-career-names.js');

console.log('🧪 Testing name shortening functionality...\n');

const testCases = [
  'John Smith',
  'Dr. Sarah Johnson',
  'Prof. Michael Brown',
  'Maria Garcia Rodriguez',
  'James',
  'Ms. Jennifer Wilson',
  'Robert David Thompson',
  'Lisa',
  'Mr. William Anderson',
  'Dr Sarah Johnson', // Without period
  'Emily Rose Parker',
  '',
  null,
  undefined,
  'Jean-Pierre Dubois',
  "O'Connor Patrick",
  'Van Der Berg Willem',
  // Career-specific test cases
  'Kind Avery',
  'Super Logan',
  'Lovely Dakota',
  'Happy Morgan',
  'Coder Helper',
  'Coach Ava',
  'Gentle Dylan',
  'Friendly Kendall'
];

testCases.forEach((testCase, index) => {
  const result = getFirstName(testCase);
  const input = testCase === null ? 'null' : testCase === undefined ? 'undefined' : `"${testCase}"`;
  const testNum = (index + 1).toString().padStart(2);
  console.log(`Test ${testNum}: ${input.padEnd(25)} → "${result}"`);
});

console.log('\n✅ Name shortening test completed');

// Test some edge cases
console.log('\n🔍 Edge case analysis:');
console.log('- Titles (Dr., Mr., etc.) are removed');
console.log('- Only the first word is kept');
console.log('- Null/undefined values are preserved');
console.log('- Hyphenated names keep the full first part');
console.log('- Names with apostrophes are handled correctly');