import { generateMerchantTemplate, generateTransactionTemplate } from '@/lib/csv-utils';

// This is a test utility to generate sample CSV files for testing
console.log('=== Sample Merchant CSV Template ===');
console.log(generateMerchantTemplate());
console.log('');

console.log('=== Sample Transaction CSV Template ===');
console.log(generateTransactionTemplate());
console.log('');

console.log('To test the import functionality:');
console.log('1. Copy the above templates to a .csv file');
console.log('2. Modify the data as needed');
console.log('3. Use the Import Merchants or Import Transactions button in the header');
console.log('');
console.log('To test the export functionality:');
console.log('1. Click the Export Merchants or Export Transactions button in the header');
console.log('2. The CSV file will be downloaded automatically');