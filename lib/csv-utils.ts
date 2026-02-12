import { z } from 'zod';

// Define Zod schemas for validation
const MerchantSchema = z.object({
  merchant_name: z.string().min(1, "Merchant name is required"),
  keyword_code: z.string().min(1, "Keyword code is required"),
  uniq_merchant: z.string().min(1, "Unique merchant is required"),
  cluster_id: z.number().int().positive("Cluster ID must be a positive integer"),
  category_id: z.number().int().positive("Category ID must be a positive integer"),
});

const TransactionSchema = z.object({
  transaction_at: z.string().datetime(),
  rule_key: z.string().uuid("Rule key must be a valid UUID"),
  merchant_key: z.string().uuid("Merchant key must be a valid UUID"),
  status: z.enum(['success', 'failed']),
  qty: z.number().int().positive().default(1),
  point_redeem: z.number().int().nonnegative(),
  msisdn: z.string().regex(/^\d{8,20}$/, "MSISDN must be 8-20 digits"),
  keyword: z.string().optional(), // Added for CSV mapping
});

export type MerchantData = z.infer<typeof MerchantSchema> & {
  category_name?: string;
  cluster_name?: string;
  branch_name?: string;
  region_name?: string;
};

export type TransactionData = z.infer<typeof TransactionSchema> & {
  keyword: string; // Added for CSV mapping
};

/**
 * Simple CSV parser that handles basic CSV format
 */
function parseCSV(csvText: string, delimiter: string = ','): string[][] {
  const lines = csvText.trim().split(/\r?\n/);
  const result: string[][] = [];
  
  for (const line of lines) {
    if (line.trim() === '') continue;
    
    // Simple CSV parsing that handles quoted fields
    const fields: string[] = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;
    
    while (i < line.length) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          // Handle escaped quotes
          currentField += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
      
      i++;
    }
    
    fields.push(currentField.trim());
    result.push(fields);
  }
  
  return result;
}

/**
 * Parse and validate CSV data for merchants
 */
export async function parseMerchantCSV(csvText: string): Promise<MerchantData[]> {
  const rows = parseCSV(csvText, ';'); // Use semicolon as delimiter for your files
  if (rows.length < 2) {
    throw new Error("CSV must contain headers and at least one data row");
  }
  
  const headers = rows[0];
  const dataRows = rows.slice(1);
  
  // Find column indices - map your CSV headers to expected field names
  const headerMap: Record<string, string> = {
    'uniq_merchant': 'uniq_merchant',
    'merchant_name': 'merchant_name',
    'keyword': 'keyword_code',
    'category': 'category_name',
    'point_redeem': 'point_redeem',
    'start_period': 'start_period',
    'end_period': 'end_period',
    'cluster': 'cluster_name',
    'branch': 'branch_name',
    'region': 'region_name'
  };
  
  // Normalize headers to lowercase for comparison
  const normalizedHeaders: Record<string, number> = {};
  for (let i = 0; i < headers.length; i++) {
    const normalizedHeader = headers[i].toLowerCase().trim();
    if (normalizedHeader in headerMap) {
      normalizedHeaders[normalizedHeader] = i;
    }
  }
  
  // Check required headers
  const requiredHeaders = ['uniq_merchant', 'merchant_name', 'keyword'];
  for (const header of requiredHeaders) {
    if (!(header in normalizedHeaders)) {
      throw new Error(`Missing required header: ${header}`);
    }
  }
  
  const validatedRecords: MerchantData[] = [];
  
  for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
    const row = dataRows[rowIndex];
    
    // Create record object from row data
    const record: Record<string, any> = {};
    for (const [header, colIndex] of Object.entries(normalizedHeaders)) {
      record[headerMap[header]] = row[colIndex] || '';
    }
    
    // Map to expected field names and convert types
    const processedRecord = {
      merchant_name: record.merchant_name || '',
      keyword_code: record.keyword_code || '',
      uniq_merchant: record.uniq_merchant || '',
      cluster_id: 1, // Default value - will be set based on cluster mapping
      category_id: 1, // Default value - will be set based on category mapping
      category_name: record.category_name || 'General',
      cluster_name: record.cluster_name || 'General',
      branch_name: record.branch_name || 'General',
      region_name: record.region_name || 'Jawa Timur',
    };
    
    try {
      const validated = MerchantSchema.parse(processedRecord);
      validatedRecords.push(validated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error on row ${rowIndex + 2}: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }
  
  return validatedRecords;
}

/**
 * Parse and validate CSV data for transactions
 */
export async function parseTransactionCSV(csvText: string): Promise<TransactionData[]> {
  const rows = parseCSV(csvText, ';'); // Use semicolon as delimiter for your files
  if (rows.length < 2) {
    throw new Error("CSV must contain headers and at least one data row");
  }
  
  const headers = rows[0];
  const dataRows = rows.slice(1);
  
  // Find column indices - map your CSV headers to expected field names
  const headerMap: Record<string, string> = {
    'timestamp': 'timestamp',
    'keyword': 'keyword',
    'msisdn': 'msisdn',
    'quantity': 'quantity',
    'status': 'status'
  };
  
  // Normalize headers to lowercase for comparison
  const normalizedHeaders: Record<string, number> = {};
  for (let i = 0; i < headers.length; i++) {
    const normalizedHeader = headers[i].toLowerCase().trim();
    if (normalizedHeader in headerMap) {
      normalizedHeaders[normalizedHeader] = i;
    }
  }
  
  // Check required headers
  const requiredHeaders = ['timestamp', 'keyword', 'msisdn', 'status'];
  for (const header of requiredHeaders) {
    if (!(header in normalizedHeaders)) {
      throw new Error(`Missing required header: ${header}`);
    }
  }
  
  const validatedRecords: TransactionData[] = [];
  
  for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
    const row = dataRows[rowIndex];
    
    // Create record object from row data
    const record: Record<string, any> = {};
    for (const [header, colIndex] of Object.entries(normalizedHeaders)) {
      record[headerMap[header]] = row[colIndex] || '';
    }
    
    // Convert timestamp to ISO format
    let transactionAt = new Date(record.timestamp).toISOString();
    if (isNaN(new Date(record.timestamp).getTime())) {
      // If the date parsing fails, try to format it differently
      const dateStr = record.timestamp;
      // Handle the format like "Sun Nov 02 2025 00:24:55 GMT+0700 (WIB)"
      const dateMatch = dateStr.match(/(\w+)\s+(\w+)\s+(\d+)\s+(\d{4})\s+(\d{2}:\d{2}:\d{2})/);
      if (dateMatch) {
        const [, , month, day, year, time] = dateMatch;
        transactionAt = new Date(`${month} ${day} ${year} ${time}`).toISOString();
      } else {
        transactionAt = new Date().toISOString(); // fallback
      }
    }
    
    // Convert status to lowercase and validate
    const status = record.status.toLowerCase() === 'fail' ? 'failed' : 'success';
    
    // Process the record
    const processedRecord = {
      transaction_at: transactionAt,
      rule_key: '00000000-0000-0000-0000-000000000000', // Will be set later based on keyword
      merchant_key: '00000000-0000-0000-0000-000000000000', // Will be set later based on keyword
      status: status as 'success' | 'failed',
      qty: parseInt(record.quantity, 10) || 1,
      point_redeem: 0, // Will be set based on merchant data
      msisdn: record.msisdn || '',
      keyword: record.keyword || '', // Store the keyword for later lookup
    };
    
    try {
      const validated = TransactionSchema.parse(processedRecord);
      validatedRecords.push(validated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error on row ${rowIndex + 2}: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }
  
  return validatedRecords;
}

/**
 * Generate a sample CSV template for merchants
 */
export function generateMerchantTemplate(): string {
  return `merchant_name,keyword_code,uniq_merchant,cluster_id,category_id
Example Merchant,SHOP123,UNIQ001,1,1
Another Merchant,PAY456,UNIQ002,2,2`;
}

/**
 * Generate a sample CSV template for transactions
 */
export function generateTransactionTemplate(): string {
  return `transaction_at,rule_key,merchant_key,status,qty,point_redeem,msisdn
2023-01-15T10:30:00Z,123e4567-e89b-12d3-a456-426614174000,123e4567-e89b-12d3-a456-426614174001,success,1,100,1234567890
2023-01-15T11:45:00Z,123e4567-e89b-12d3-a456-426614174002,123e4567-e89b-12d3-a456-426614174003,failed,2,200,1234567891`;
}