import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PurchaseInvoice, PurchaseItem, Product } from '@/types';
import RoleGuard from '@/components/auth/role-guard';
import { formatCurrency, formatDate } from '@/lib/utils/format';

export default function ViewPurchasePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<PurchaseInvoice | null>(null);
  const [items, setItems] = useState<(PurchaseItem & { product: Product })[]>([]);
  const [branchName, setBranchName] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const router = useRouter();
  const params = useParams();
  const purchaseId = params?.id as string;
  
  useEffect(() => {
    const fetchPurchaseDetails = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const supabase = createClient();
        
        // Fetch invoice details
        const { data: invoiceData, error: invoiceError } = await supabase
          .from('purchase_invoices')
          .select('*')
          .eq('id', purchaseId)
          .single();
          
        if (invoiceError) {
          throw new Error(invoiceError.message);
        }
        
        // Fetch branch name
        const { data: branchData, error: branchError } = await supabase
          .from('branches')
          .select('name')
          .eq('id', invoiceData.branch_id)
          .single();
          
        if (branchError) {
          throw new Error(branchError.message);
        }
        
        // Fetch user name
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', invoiceData.created_by)
          .single();
          
        if (userError && userError.code !== 'PGRST116') { // Ignore if user not found
          throw new Error(userError.message);
        }
        
        // Fetch invoice items with product details
        const { data: itemsData, error: itemsError } = await supabase
          .from('purchase_items')
          .select(`
            *,
            product:product_id (*)
          `)
          .eq('purchase_invoice_id', purchaseId);
          
        if (itemsError) {
          throw new Error(itemsError.message);
        }
        
        setInvoice(invoiceData);
        setBranchName(branchData.name);
        setUserName(userData?.full_name || 'غير معروف');
        setItems(itemsData || []);
      } catch (err: any) {
        setError(err.message || 'حدث خطأ أثناء جلب بيانات الفاتورة');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (purchaseId) {
      fetchPurchaseDetails();
    }
  }, [purchaseId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="p-6">
        <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900 dark:text-red-100">
          {error || 'لم يتم العثور على الفاتورة'}
        </div>
        <button
          onClick={() => router.push('/dashboard/purchases')}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          العودة إلى قائمة الفواتير
        </button>
      </div>
    );
  }

  return (
    <RoleGuard allowedRoles={['admin', 'branch_manager']}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">تفاصيل فاتورة الشراء</h1>
          <button
            onClick={() => router.push('/dashboard/purchases')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            العودة إلى القائمة
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">معلومات الفاتورة</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">رقم الفاتورة</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{invoice.invoice_number}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">المورد</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{invoice.supplier}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">الفرع</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{branchName}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">تاريخ الإنشاء</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{formatDate(invoice.created_at)}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">بواسطة</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{userName}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">المبلغ الإجمالي</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{formatCurrency(invoice.total_amount)} ريال</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">ضريبة القيمة المضافة</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{formatCurrency(invoice.vat_amount)} ريال</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">المبلغ بدون ضريبة</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{formatCurrency(invoice.total_amount - invoice.vat_amount)} ريال</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">عناصر الفاتورة</h2>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    المنتج
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    SKU
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    الكمية
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    سعر الوحدة
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    نسبة الضريبة
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    الإجمالي
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {item.product.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {item.product.sku}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {item.quantity} {item.product.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatCurrency(item.unit_price)} ريال
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {item.vat_percentage}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatCurrency(item.total_price)} ريال
                    </td>
                  </tr>
                ))}
                
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      لا توجد عناصر في هذه الفاتورة
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-left text-sm font-medium text-gray-900 dark:text-white">
                    المجموع الفرعي:
                  </td>
                  <td className="px-6 py-4 text-left text-sm font-medium text-gray-900 dark:text-white">
                    {formatCurrency(invoice.total_amount - invoice.vat_amount)} ريال
                  </td>
                </tr>
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-left text-sm font-medium text-gray-900 dark:text-white">
                    ضريبة القيمة المضافة:
                  </td>
                  <td className="px-6 py-4 text-left text-sm font-medium text-gray-900 dark:text-white">
                    {formatCurrency(invoice.vat_amount)} ريال
                  </td>
                </tr>
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-left text-sm font-bold text-gray-900 dark:text-white">
                    الإجمالي:
                  </td>
                  <td className="px-6 py-4 text-left text-sm font-bold text-gray-900 dark:text-white">
                    {formatCurrency(invoice.total_amount)} ريال
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
