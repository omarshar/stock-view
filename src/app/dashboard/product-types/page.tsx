import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ProductType } from '@/types';
import RoleGuard from '@/components/auth/role-guard';

export default function ProductTypesPage() {
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  useEffect(() => {
    const fetchProductTypes = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const supabase = createClient();
        
        const { data, error: fetchError } = await supabase
          .from('product_types')
          .select('*')
          .order('name', { ascending: true });
          
        if (fetchError) {
          throw new Error(fetchError.message);
        }
        
        setProductTypes(data || []);
      } catch (err: any) {
        setError(err.message || 'حدث خطأ أثناء جلب بيانات أنواع المنتجات');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProductTypes();
  }, []);
  
  const handleDeleteProductType = async (typeId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا النوع؟')) {
      return;
    }
    
    try {
      const supabase = createClient();
      
      // التحقق من وجود منتجات مرتبطة بهذا النوع
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id')
        .eq('product_type_id', typeId)
        .limit(1);
        
      if (productsError) {
        throw new Error(productsError.message);
      }
      
      if (productsData && productsData.length > 0) {
        throw new Error('لا يمكن حذف هذا النوع لأنه مرتبط بمنتجات');
      }
      
      // حذف النوع
      const { error: deleteError } = await supabase
        .from('product_types')
        .delete()
        .eq('id', typeId);
        
      if (deleteError) {
        throw new Error(deleteError.message);
      }
      
      // تحديث قائمة الأنواع
      setProductTypes(productTypes.filter(type => type.id !== typeId));
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حذف النوع');
    }
  };
  
  const handleEditProductType = (typeId: string) => {
    router.push(`/dashboard/product-types/edit/${typeId}`);
  };

  return (
    <RoleGuard allowedRoles={['admin', 'branch_manager']}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">إدارة أنواع المنتجات</h1>
          <button
            onClick={() => router.push('/dashboard/product-types/add')}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            إضافة نوع جديد
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
                    اسم النوع
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    الوصف
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    تاريخ الإنشاء
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
                {productTypes.map((type) => (
                  <tr key={type.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {type.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {type.description || 'لا يوجد وصف'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(type.created_at).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEditProductType(type.id)}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 ml-4"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => handleDeleteProductType(type.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
                
                {productTypes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      لا توجد أنواع منتجات
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
