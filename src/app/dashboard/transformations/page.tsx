import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Transformation } from '@/types';
import RoleGuard from '@/components/auth/role-guard';
import { formatCurrency, formatDate } from '@/lib/utils/format';

export default function TransformationsPage() {
  const [transformations, setTransformations] = useState<(Transformation & { branch_name: string, created_by_name: string, target_product_name: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  useEffect(() => {
    const fetchTransformations = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const supabase = createClient();
        
        // Fetch transformations with branch, user, and product details
        const { data, error: fetchError } = await supabase
          .from('transformations')
          .select(`
            *,
            branch:branch_id (name),
            user:created_by (full_name),
            target_product:target_product_id (name)
          `)
          .order('created_at', { ascending: false });
          
        if (fetchError) {
          throw new Error(fetchError.message);
        }
        
        // Transform data to include branch, user, and product names
        const formattedData = data?.map(item => ({
          ...item,
          branch_name: item.branch?.name || 'غير معروف',
          created_by_name: item.user?.full_name || 'غير معروف',
          target_product_name: item.target_product?.name || 'غير معروف'
        })) || [];
        
        setTransformations(formattedData);
      } catch (err: any) {
        setError(err.message || 'حدث خطأ أثناء جلب بيانات عمليات التحويل');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTransformations();
  }, []);
  
  const handleViewTransformation = (transformationId: string) => {
    router.push(`/dashboard/transformations/view/${transformationId}`);
  };
  
  const handleDeleteTransformation = async (transformationId: string) => {
    if (!confirm('هل أنت متأكد من حذف عملية التحويل هذه؟ سيتم تعديل المخزون تلقائياً.')) {
      return;
    }
    
    try {
      const supabase = createClient();
      
      // حذف عملية التحويل (سيتم تنفيذ الـ Trigger في قاعدة البيانات لتعديل المخزون)
      const { error: deleteError } = await supabase
        .from('transformations')
        .delete()
        .eq('id', transformationId);
        
      if (deleteError) {
        throw new Error(deleteError.message);
      }
      
      // تحديث قائمة عمليات التحويل
      setTransformations(transformations.filter(transformation => transformation.id !== transformationId));
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حذف عملية التحويل');
    }
  };

  return (
    <RoleGuard allowedRoles={['admin', 'branch_manager']}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">عمليات التصنيع والتحويل</h1>
          <button
            onClick={() => router.push('/dashboard/transformations/add')}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            إضافة عملية تحويل جديدة
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
                    رقم العملية
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    المنتج النهائي
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    الكمية المنتجة
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    الفرع
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    التكلفة الإجمالية
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    تاريخ العملية
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
                {transformations.map((transformation) => (
                  <tr key={transformation.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {transformation.reference_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {transformation.target_product_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {transformation.target_quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {transformation.branch_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatCurrency(transformation.total_cost)} ريال
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(transformation.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {transformation.created_by_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleViewTransformation(transformation.id)}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 ml-4"
                      >
                        عرض
                      </button>
                      <button
                        onClick={() => handleDeleteTransformation(transformation.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
                
                {transformations.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      لا توجد عمليات تحويل
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
