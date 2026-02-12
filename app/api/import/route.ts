import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { parseMerchantCSV, parseTransactionCSV } from '@/lib/csv-utils';
import { insertMerchants, insertTransactions } from '@/lib/import-service';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    let result: { inserted: number; errors: string[] } = { inserted: 0, errors: [] };
    
    // Determine file type and process accordingly
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.zip')) {
      // Handle ZIP file
      const zipBuffer = await file.arrayBuffer();
      const zip = new JSZip();
      const zipContents = await zip.loadAsync(zipBuffer);
      
      // Process each file in the ZIP
      for (const [filename, zipEntry] of Object.entries(zipContents.files)) {
        if (!zipEntry.dir) { // Skip directories
          if (filename.toLowerCase().endsWith('.csv')) {
            const content = await zipEntry.async('text');
            
            // Determine if it's a merchant or transaction file based on filename
            if (filename.toLowerCase().includes('master') || filename.toLowerCase().includes('merchant')) {
              const parsedData = await parseMerchantCSV(content);
              const merchantResult = await insertMerchants(parsedData);
              result.inserted += merchantResult.inserted;
              result.errors.push(...merchantResult.errors);
            } else if (filename.toLowerCase().includes('transaction') || filename.toLowerCase().includes('trans')) {
              const parsedData = await parseTransactionCSV(content);
              const transactionResult = await insertTransactions(parsedData);
              result.inserted += transactionResult.inserted;
              result.errors.push(...transactionResult.errors);
            } else {
              // If we can't determine the type, try both parsers
              try {
                const parsedData = await parseMerchantCSV(content);
                const merchantResult = await insertMerchants(parsedData);
                result.inserted += merchantResult.inserted;
                result.errors.push(...merchantResult.errors);
              } catch (merchantError) {
                try {
                  const parsedData = await parseTransactionCSV(content);
                  const transactionResult = await insertTransactions(parsedData);
                  result.inserted += transactionResult.inserted;
                  result.errors.push(...transactionResult.errors);
                } catch (transactionError) {
                  result.errors.push(`Could not parse ${filename} as either merchant or transaction data: ${merchantError.message}, ${transactionError.message}`);
                }
              }
            }
          }
        }
      }
    } else if (fileName.endsWith('.csv')) {
      // Handle CSV file directly
      const text = await file.text();
      
      // Determine if it's a merchant or transaction file based on filename
      if (fileName.toLowerCase().includes('master') || fileName.toLowerCase().includes('merchant')) {
        const parsedData = await parseMerchantCSV(text);
        result = await insertMerchants(parsedData);
      } else if (fileName.toLowerCase().includes('transaction') || fileName.toLowerCase().includes('trans')) {
        const parsedData = await parseTransactionCSV(text);
        result = await insertTransactions(parsedData);
      } else {
        // If we can't determine the type, try both parsers
        try {
          const parsedData = await parseMerchantCSV(text);
          result = await insertMerchants(parsedData);
        } catch (merchantError) {
          try {
            const parsedData = await parseTransactionCSV(text);
            result = await insertTransactions(parsedData);
          } catch (transactionError) {
            return NextResponse.json({ 
              error: `Could not parse file as either merchant or transaction data: ${merchantError.message}, ${transactionError.message}`,
              success: false 
            }, { status: 400 });
          }
        }
      }
    } else {
      return NextResponse.json({ 
        error: 'Unsupported file format. Please upload a CSV or ZIP file.',
        success: false 
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      inserted: result.inserted,
      errors: result.errors,
      message: `Successfully imported data. ${result.inserted} records processed. ${result.errors.length} error(s) occurred.`
    });
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json({ 
      error: error.message || 'An error occurred during import', 
      success: false 
    }, { status: 500 });
  }
}