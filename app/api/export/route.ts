import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dimMerchant, factTransaction } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import { PDFDocument, StandardFonts } from 'pdf-lib';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dataType = searchParams.get('type');
    const format = searchParams.get('format') || 'csv';

    if (!dataType || !['merchant', 'transaction'].includes(dataType)) {
      return NextResponse.json({ error: 'Invalid data type. Must be "merchant" or "transaction"' }, { status: 400 });
    }

    let data: any[];
    let filename: string;
    let headers: string[];

    if (dataType === 'merchant') {
      data = await db
        .select({
          merchant_name: dimMerchant.merchantName,
          keyword_code: dimMerchant.keywordCode,
          uniq_merchant: dimMerchant.uniqMerchant,
          cluster_id: dimMerchant.clusterId,
          category_id: dimMerchant.categoryId,
        })
        .from(dimMerchant);

      filename = `merchants.${format}`;
      headers = ['merchant_name', 'keyword_code', 'uniq_merchant', 'cluster_id', 'category_id'];
    } else {
      data = await db
        .select({
          transaction_at: factTransaction.transactionAt,
          rule_key: factTransaction.ruleKey,
          merchant_key: factTransaction.merchantKey,
          status: factTransaction.status,
          qty: factTransaction.qty,
          point_redeem: factTransaction.pointRedeem,
          msisdn: factTransaction.msisdn,
        })
        .from(factTransaction);

      filename = `transactions.${format}`;
      headers = ['transaction_at', 'rule_key', 'merchant_key', 'status', 'qty', 'point_redeem', 'msisdn'];
    }

    if (format === 'csv') {
      // Generate CSV content
      const csvContent = [
        headers.join(','),
        ...data.map(row => 
          headers.map(header => {
            let value = row[header as keyof typeof row];
            
            // Handle special cases for CSV formatting
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
              // Escape quotes and wrap in quotes for CSV
              value = `"${value.replace(/"/g, '""')}"`;
            }
            
            return value;
          }).join(',')
        )
      ].join('\n');

      // Create response with CSV content
      const response = new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });

      return response;
    } else if (format === 'xlsx') {
      // Create XLSX workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, `${dataType}s`);
      
      // Generate XLSX buffer
      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      
      // Create response with XLSX content
      const response = new Response(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });

      return response;
    } else if (format === 'pdf') {
      // Create PDF document
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 800]); // A4-like dimensions
      
      // Embed fonts
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      // Add title
      const title = `${dataType.charAt(0).toUpperCase() + dataType.slice(1)} Report`;
      page.drawText(title, {
        x: 50,
        y: 750,
        size: 18,
        font: helveticaBoldFont,
      });
      
      // Add headers
      let yPosition = 700;
      const rowHeight = 20;
      const cellPadding = 5;
      const columnWidth = 600 / headers.length;
      
      // Draw header row
      for (let i = 0; i < headers.length; i++) {
        page.drawText(headers[i], {
          x: 50 + (i * columnWidth),
          y: yPosition,
          size: 10,
          font: helveticaBoldFont,
        });
      }
      
      yPosition -= rowHeight;
      
      // Draw data rows
      for (let i = 0; i < data.length && yPosition > 50; i++) {
        const row = data[i];
        
        for (let j = 0; j < headers.length; j++) {
          const value = row[headers[j]];
          page.drawText(String(value || ''), {
            x: 50 + (j * columnWidth),
            y: yPosition,
            size: 10,
            font: helveticaFont,
          });
        }
        
        yPosition -= rowHeight;
        
        // If we run out of space, add a new page
        if (yPosition <= 50) {
          page.drawText('... (continued on next page)', {
            x: 50,
            y: yPosition,
            size: 10,
            font: helveticaFont,
          });
          
          // Add new page
          const newPage = pdfDoc.addPage([600, 800]);
          yPosition = 700;
        }
      }
      
      // Generate PDF buffer
      const pdfBytes = await pdfDoc.save();
      
      // Create response with PDF content
      const response = new Response(pdfBytes, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });

      return response;
    } else {
      // Return JSON format for unsupported formats
      return NextResponse.json(data);
    }
  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'An error occurred during export' }, { status: 500 });
  }
}