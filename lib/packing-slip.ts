import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { OrderWithItems } from './types';
import { formatDate } from './utils';
import { getInvoiceNumber } from './invoice-number';
import { LOGO_BASE64 } from './logo-base64';

interface PackingSlipData {
  order: OrderWithItems;
  bakeryInfo: {
    name: string;
    phone: string;
    address: string;
  };
}

export async function generatePackingSlip(data: PackingSlipData): Promise<jsPDF> {
  const { order, bakeryInfo } = data;
  const doc = new jsPDF();
  
  const logoColor: [number, number, number] = [206, 17, 38];
  const textColor: [number, number, number] = [0, 0, 0];
  
  const margin = 20;
  let yPos = margin;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 50, 'F');
  
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
  doc.text(bakeryInfo.address, margin + 30, yPos + 25);

  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('PACKING SLIP', 210 - margin, 25, { align: 'right' });
  
  yPos = 60;
  doc.setFillColor(250, 250, 250);
  doc.rect(210 - 90, yPos, 70, 32, 'F');
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Order #:', 210 - 85, yPos + 8);
  doc.text('Delivery Date:', 210 - 85, yPos + 16);
  doc.text('Packed Date:', 210 - 85, yPos + 24);
  
  doc.setFont('helvetica', 'normal');
  const invoiceNumber = await getInvoiceNumber(order.id);
  const orderNum = invoiceNumber.toString().padStart(6, '0');
  const deliveryDate = new Date(order.delivery_date).toLocaleDateString('en-AU');
  const packedDate = new Date().toLocaleDateString('en-AU');
  
  doc.text(orderNum, 210 - margin - 2, yPos + 8, { align: 'right' });
  doc.text(deliveryDate, 210 - margin - 2, yPos + 16, { align: 'right' });
  doc.text(packedDate, 210 - margin - 2, yPos + 24, { align: 'right' });

  yPos = 60;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('DELIVER TO:', margin, yPos);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  yPos += 8;
  
  if (order.customer_business_name) {
    doc.setFont('helvetica', 'bold');
    doc.text(order.customer_business_name, margin, yPos);
    yPos += 6;
  }
  
  doc.setFont('helvetica', 'normal');
  doc.text(order.customer_email, margin, yPos);
  
  const customerAddress = (order as any).customer_address;
  if (customerAddress) {
    yPos += 5;
    doc.text(customerAddress, margin, yPos);
  }

  yPos = 110;
  
  const tableData = order.order_items.map(item => [
    item.product_name,
    item.quantity.toString(),
    '☐',
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Product', 'Quantity', 'Picked']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [0, 0, 0],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 10,
      textColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 40, halign: 'center', fontSize: 12, fontStyle: 'bold' },
      2: { cellWidth: 25, halign: 'center', fontSize: 14 },
    },
    margin: { left: margin, right: margin },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 15;

  const totalItems = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
  
  doc.setFillColor(0, 0, 0);
  doc.rect(210 - 85, finalY, 65, 10, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL ITEMS:', 210 - 80, finalY + 7);
  doc.text(totalItems.toString(), 210 - margin, finalY + 7, { align: 'right' });

  if (order.notes) {
    doc.setTextColor(...textColor);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTES:', margin, finalY + 25);
    doc.setFont('helvetica', 'normal');
    const splitNotes = doc.splitTextToSize(order.notes, 170);
    doc.text(splitNotes, margin, finalY + 32);
  }

  const sigY = 250;
  doc.setDrawColor(0, 0, 0);
  doc.line(margin, sigY, margin + 80, sigY);
  doc.setFontSize(8);
  doc.text('Packed by:', margin, sigY - 3);
  doc.text('Signature', margin, sigY + 5);
  
  doc.line(210 - margin - 80, sigY, 210 - margin, sigY);
  doc.text('Received by:', 210 - margin - 80, sigY - 3);
  doc.text('Signature', 210 - margin - 80, sigY + 5);

  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text(`Printed: ${new Date().toLocaleDateString('en-AU')}`, 105, 285, { align: 'center' });
  
  return doc;
}