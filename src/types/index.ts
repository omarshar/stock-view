export type UserRole = 'admin' | 'branch_manager' | 'user';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  branch_id?: string;
  created_at: string;
  last_sign_in_at?: string;
}

export interface Branch {
  id: string;
  name: string;
  location: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface ProductType {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  description?: string;
  category_id: string;
  product_type_id: string;
  unit: string;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  product_id: string;
  branch_id: string;
  quantity: number;
  average_cost: number;
  updated_at: string;
}

export interface PurchaseInvoice {
  id: string;
  invoice_number: string;
  supplier: string;
  branch_id: string;
  total_amount: number;
  vat_amount: number;
  created_by: string;
  created_at: string;
}

export interface PurchaseItem {
  id: string;
  purchase_invoice_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  vat_percentage: number;
  total_price: number;
}

export interface Transformation {
  id: string;
  branch_id: string;
  final_product_id: string;
  final_quantity: number;
  created_by: string;
  created_at: string;
}

export interface TransformationItem {
  id: string;
  transformation_id: string;
  raw_product_id: string;
  quantity: number;
}

export interface WasteRecord {
  id: string;
  branch_id: string;
  product_id: string;
  quantity: number;
  reason: string;
  recorded_by: string;
  recorded_at: string;
}

export interface InventoryAudit {
  id: string;
  branch_id: string;
  audit_date: string;
  status: 'draft' | 'completed';
  created_by: string;
  created_at: string;
}

export interface InventoryAuditItem {
  id: string;
  audit_id: string;
  product_id: string;
  expected_quantity: number;
  actual_quantity: number;
  difference: number;
}
