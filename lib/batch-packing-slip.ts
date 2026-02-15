import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from './utils';
import { getInvoiceNumber } from './invoice-number';
import { LOGO_BASE64 } from './logo-base64';

interface OrderItem {
  product_name: string;
  quantity: number;
}

interface Order {
  id: string;
  customer_business_name: string | null;
  customer_email: string;
  delivery_date: string;
  order_items: OrderItem[];
}

export async function generateBatchPackingSlips(orders: Order[], bakeryInfo: any): Promise<jsPDF> {
  const doc = new jsPDF();
  const logoColor: [number, number, number] = [206, 17, 38];
  const textColor: [number, number, number] = [0, 0, 0];
  
  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    
    if (i > 0) {
      doc.addPage();
    }
    
    const margin = 20;
    let yPos = margin;

    // Logo
    try {
      doc.addImage(LOGO_BASE64, 'PNG', margin, yPos + 2, 25, 25);
    } catch {
      doc.setFillColor(...logoColor);
      doc.circle(margin + 12, yPos + 12, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('D', margin + 12, yPos + 15, { align: 'center' });
    }
    
    doc.setTextColor(...textColor);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(bakeryInfo.name, margin + 30, yPos + 12);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(bakeryInfo.phone, margin + 30, yPos + 20);

    // PACKING SLIP
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('PACKING SLIP', 210 - margin, 25, { align: 'right' });
    
    // Details
    yPos = 60;
    doc.setFillColor(250, 250, 250);
    doc.rect(210 - 90, yPos, 70, 24, 'F');
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Order #:', 210 - 85, yPos + 8);
    doc.text('Delivery:', 210 - 85, yPos + 16);
    
    doc.setFont('helvetica', 'normal');
    const invoiceNumber = await getInvoiceNumber(order.id);
    const orderNum = invoiceNumber.toString().padStart(6, '0');
    
    doc.text(orderNum, 210 - margin - 2, yPos + 8, { align: 'right' });
    doc.text(formatDate(order.delivery_date), 210 - margin - 2, yPos + 16, { align: 'right' });

    // Customer
    yPos = 60;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('DELIVER TO:', margin, yPos);
    
    doc.setFontSize(11);
    yPos += 8;
    doc.text(order.customer_business_name || order.customer_email, margin, yPos);

    // Items
    yPos = 95;
    
    const tableData = order.order_items.map(item => [
      item.product_name,
      item.quantity.toString(),
      '☐',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Product', 'Qty', '✓']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
      },
      bodyStyles: {
        fontSize: 11,
        textColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: 130 },
        1: { cellWidth: 30, halign: 'center', fontSize: 14, fontStyle: 'bold' },
        2: { cellWidth: 15, halign: 'center', fontSize: 16 },
      },
      margin: { left: margin, right: margin },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    // Total
    const totalItems = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
    
    doc.setFillColor(0, 0, 0);
    doc.rect(210 - 80, finalY, 60, 10, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', 210 - 75, finalY + 7);
    doc.text(totalItems.toString(), 210 - margin, finalY + 7, { align: 'right' });

    // Signature
    const sigY = 250;
    doc.setDrawColor(0, 0, 0);
    doc.setTextColor(...textColor);
    doc.setFontSize(8);
    doc.line(margin, sigY, margin + 70, sigY);
    doc.text('Packed by', margin, sigY + 5);
  }
  
  return doc;
}