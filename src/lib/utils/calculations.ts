import { formatCurrency } from '@/lib/utils/format';

export function calculateVAT(amount: number, vatRate: number = 0.15): number {
  return amount * vatRate;
}

export function calculateTotalWithVAT(amount: number, vatRate: number = 0.15): number {
  return amount + calculateVAT(amount, vatRate);
}

export function calculateAverageCost(
  currentQuantity: number,
  currentAverageCost: number,
  newQuantity: number,
  newCost: number
): number {
  if (currentQuantity === 0 && newQuantity === 0) {
    return 0;
  }
  
  const totalValue = currentQuantity * currentAverageCost + newQuantity * newCost;
  const totalQuantity = currentQuantity + newQuantity;
  
  return totalValue / totalQuantity;
}

export { formatCurrency };
