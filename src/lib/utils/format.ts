export function formatCurrency(value: number): string {
  return value.toLocaleString('ar-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatDate(date: string | Date): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('ar-SA');
}

export function generateInvoiceNumber(): string {
  const prefix = 'INV';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  return `${prefix}-${timestamp}-${random}`;
}
