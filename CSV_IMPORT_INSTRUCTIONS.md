# CSV Import Instructions

This dashboard supports importing data from your existing CSV files in the `database/ETL/` directory.

## Supported CSV Formats

### Master Data (merchants)
- File: `database/ETL/master.csv`
- Delimiter: Semicolon (`;`)
- Headers: `uniq_merchant;merchant_name;keyword;category;point_redeem;start_period;end_period;cluster;branch;region`

### Transaction Data
- File: `database/ETL/transaction.csv`
- Delimiter: Semicolon (`;`)
- Headers: `timestamp;keyword;msisdn;quantity;status`

## Import Methods

### Method 1: Using the UI
1. Navigate to any page in the dashboard
2. Click the "Import Merchants (CSV)" or "Import Transactions (CSV)" button in the header
3. Select your CSV file
4. Wait for the import to complete
5. Check the notification for results

### Method 2: Using the Script
Run the following command to import all your existing CSV files:

```bash
# Note: This requires setting up a Node.js script that can access your database
# The script is located at scripts/import-csv-data.ts
```

## Important Notes

- The import process will skip duplicate entries based on the keyword code
- For transactions, the system will automatically link to existing merchants based on the keyword
- If a merchant doesn't exist for a transaction, the transaction will be skipped
- Categories and clusters will be created automatically if they don't exist
- Dates in the format "Sun Nov 02 2025 00:24:55 GMT+0700 (WIB)" will be converted to ISO format

## Troubleshooting

- If you get "missing required header" errors, check that your CSV file has the correct headers
- If imports fail due to data validation errors, check the error messages for specific details
- For large files, the import may take some time - please be patient