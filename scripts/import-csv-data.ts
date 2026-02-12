import fs from 'fs/promises';
import path from 'path';
import { parseMerchantCSV, parseTransactionCSV } from '../lib/csv-utils';
import { insertMerchants, insertTransactions } from '../lib/import-service';

async function importFromFiles() {
  try {
    console.log('Starting import from CSV files...');
    
    // Read the master.csv file (contains merchant data)
    const masterCsvPath = path.join(process.cwd(), 'database', 'ETL', 'master.csv');
    const masterCsvContent = await fs.readFile(masterCsvPath, 'utf-8');
    
    console.log('Parsing merchant data...');
    const merchants = await parseMerchantCSV(masterCsvContent);
    console.log(`Parsed ${merchants.length} merchants`);
    
    console.log('Inserting merchant data...');
    const merchantResult = await insertMerchants(merchants);
    console.log(`Inserted ${merchantResult.inserted} merchants. ${merchantResult.errors.length} errors.`);
    if (merchantResult.errors.length > 0) {
      console.log('Errors:', merchantResult.errors);
    }
    
    // Read the transaction.csv file
    const transactionCsvPath = path.join(process.cwd(), 'database', 'ETL', 'transaction.csv');
    const transactionCsvContent = await fs.readFile(transactionCsvPath, 'utf-8');
    
    console.log('Parsing transaction data...');
    const transactions = await parseTransactionCSV(transactionCsvContent);
    console.log(`Parsed ${transactions.length} transactions`);
    
    console.log('Inserting transaction data...');
    const transactionResult = await insertTransactions(transactions);
    console.log(`Inserted ${transactionResult.inserted} transactions. ${transactionResult.errors.length} errors.`);
    if (transactionResult.errors.length > 0) {
      console.log('Errors:', transactionResult.errors);
    }
    
    console.log('Import completed!');
  } catch (error) {
    console.error('Error during import:', error);
  }
}

// Run the import
importFromFiles();