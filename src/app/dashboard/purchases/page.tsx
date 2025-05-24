import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PurchaseInvoice } from '@/types';
import RoleGuard from '@/components/auth/role-guard';
import { formatCurrency } from '@/lib/utils/format';

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<(PurchaseInvoice & { branch_name: string, created_by_name: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  useEffect(() => {
    const fetchPurchases = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const supabase = createClient();
        
        // Fetch purchases with branch and user details
        const { data, error: fetchError } = await supabase
          .from('purchase_invoices')
          .select(`
            *,
            branch:branch_id (name),
            user:created_by (full_name)
          `)
          .order('created_at', { ascending: false });
          
        if (fetchError) {
          throw new Error(fetchError.message);
        }
        
        // Transform data to include branch and user names
        const formattedData = data?.map(item => ({
          ...item,
          branch_name: item.branch?.name || 'غير معروف',
          created_by_name: item.user?.full_name || 'غير معروف'
        })) || [];
        
        setPurchases(formattedData);
      } catch (err: any) {
        setError(err.message || 'حدث خطأ أثناء جلب بيانات فواتير الشراء');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPurchases();
  }, []);
  
  const handleViewPurchase = (purchaseId: string) => {
    router.push(`/dashboard/purchases/view/${purchaseId}`);
  };
  
  const handleDeletePurchase = async (purchaseId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة؟ سيتم تعديل المخزون تلقائياً.')) {
      return;
    }
    
    try {
      const supabase = createClient();
      
      // حذف الفاتورة (سيتم تنفيذ الـ Trigger في قاعدة البيانات لتعديل المخزون)
      const { error: deleteError } = await supabase
        .from('purchase_invoices')
        .delete()
        .eq('id', purchaseId);
        
      if (deleteError) {
        throw new Error(deleteError.message);
      }
      
      // تحديث قائمة الفواتير
      setPurchases(purchases.filter(purchase => purchase.id !== purchaseId));
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حذف الفاتورة');
    }
  };

  return (
    <RoleGuard allowedRoles={['admin', 'branch_manager']}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">فواتير الشراء</h1>
          <button
            onClick={() => router.push('/dashboard/purchases/add')}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            إضافة فاتورة جديدة
          </button>
        </div>
        
        {error && (
          <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900 dark:text-red-100">
            {error}
          </div>
        )}
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    رقم الفاتورة
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    المورد
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    الفرع
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    المبلغ الإجمالي
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    ضريبة القيمة المضافة
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    تاريخ الإنشاء
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    بواسطة
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
                {purchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {purchase.invoice_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {purchase.supplier}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {purchase.branch_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatCurrency(purchase.total_amount)} ريال
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatCurrency(purchase.vat_amount)} ريال
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(purchase.created_at).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {purchase.created_by_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleViewPurchase(purchase.id)}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 ml-4"
                      >
                        عرض
                      </button>
                      <button
                        onClick={() => handleDeletePurchase(purchase.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
                
                {purchases.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      لا توجد فواتير شراء
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
