// IMMEDIATE DEBUG TEST - Save as debug-timezone.js and run: node debug-timezone.js

console.log('🚨 EMERGENCY DEBUG - Timezone and Date Parsing Issue');
console.log('='.repeat(60));

// Test the exact dates from your console
const testCases = [
  { input: '2025-08-18', expected: 'Monday' },   // Your failing case
  { input: '2025-08-20', expected: 'Wednesday' } // Your failing case
];

console.log('🔍 SYSTEM INFO:');
console.log('Timezone offset:', new Date().getTimezoneOffset());
console.log('Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
console.log('Current time:', new Date().toISOString());
console.log('Current local time:', new Date().toString());
console.log('');

testCases.forEach((testCase, index) => {
  console.log(`TEST ${index + 1}: ${testCase.input} (should be ${testCase.expected})`);
  console.log('─'.repeat(40));
  
  // Method 1: Direct Date constructor (problematic)
  const date1 = new Date(testCase.input);
  console.log('Method 1 - new Date(input):');
  console.log('  Result:', date1);
  console.log('  Day name:', date1.toLocaleDateString('en-US', { weekday: 'long' }));
  console.log('  Day index:', date1.getDay());
  console.log('  UTC string:', date1.toISOString());
  console.log('');
  
  // Method 2: Force local timezone (FIXED)
  const date2 = new Date(testCase.input + 'T00:00:00');
  console.log('Method 2 - new Date(input + "T00:00:00") [FIXED]:');
  console.log('  Result:', date2);
  console.log('  Day name:', date2.toLocaleDateString('en-US', { weekday: 'long' }));
  console.log('  Day index:', date2.getDay());
  console.log('  UTC string:', date2.toISOString());
  console.log('  Local string:', date2.toString());
  console.log('');
  
  // Method 3: Manual parsing
  const [year, month, day] = testCase.input.split('-').map(Number);
  const date3 = new Date(year, month - 1, day);
  console.log('Method 3 - Manual parsing new Date(year, month-1, day):');
  console.log('  Result:', date3);
  console.log('  Day name:', date3.toLocaleDateString('en-US', { weekday: 'long' }));
  console.log('  Day index:', date3.getDay());
  console.log('');
  
  // Compare results
  const day1 = date1.toLocaleDateString('en-US', { weekday: 'long' });
  const day2 = date2.toLocaleDateString('en-US', { weekday: 'long' });
  const day3 = date3.toLocaleDateString('en-US', { weekday: 'long' });
  
  console.log('COMPARISON:');
  console.log(`  Expected: ${testCase.expected}`);
  console.log(`  Method 1: ${day1} ${day1 === testCase.expected ? '✅' : '❌'}`);
  console.log(`  Method 2: ${day2} ${day2 === testCase.expected ? '✅' : '❌'}`);
  console.log(`  Method 3: ${day3} ${day3 === testCase.expected ? '✅' : '❌'}`);
  console.log('');
});

// Test database working days matching
console.log('🔍 WORKING DAYS MATCHING TEST:');
console.log('─'.repeat(40));

const dbWorkingDays = ["monday", "tuesday", "wednesday", "thursday"]; // From your DB
const testDate = '2025-08-18'; // Monday

const targetDate = new Date(testDate + 'T00:00:00');
const dayName = targetDate.toLocaleDateString('en-US', { weekday: 'long' });

console.log('Database working days:', dbWorkingDays);
console.log('Test date:', testDate);
console.log('Calculated day name:', dayName);
console.log('Day name lowercase:', dayName.toLowerCase());
console.log('');

dbWorkingDays.forEach(workingDay => {
  const match = workingDay.toLowerCase() === dayName.toLowerCase();
  console.log(`"${workingDay}" vs "${dayName.toLowerCase()}" = ${match ? '✅ MATCH' : '❌ NO MATCH'}`);
});

console.log('');
console.log('🎯 FINAL RESULT:');
const isWorkingDay = dbWorkingDays.some(day => 
  day.toLowerCase() === dayName.toLowerCase()
);
console.log(`Is ${testDate} (${dayName}) a working day? ${isWorkingDay ? '✅ YES' : '❌ NO'}`);

console.log('');
console.log('🚀 RECOMMENDED FIXES:');
console.log('1. Backend: Use new Date(date + "T00:00:00") instead of moment');
console.log('2. Frontend: Use the same date parsing method');
console.log('3. Always use .toLowerCase() for day name comparisons');
console.log('4. Ensure API returns storeInfo in the response');

// Detect the specific issue
if (new Date('2025-08-18').getDay() !== new Date('2025-08-18T00:00:00').getDay()) {
  console.log('');
  console.log('🚨 DETECTED: TIMEZONE ISSUE!');
  console.log('Your system is interpreting bare date strings in UTC, causing day shifts.');
  console.log('SOLUTION: Always append "T00:00:00" to date strings for local timezone.');
}