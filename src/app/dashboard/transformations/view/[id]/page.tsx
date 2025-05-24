import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Transformation, TransformationItem, Product } from '@/types';
import RoleGuard from '@/components/auth/role-guard';
import { formatCurrency, formatDate } from '@/lib/utils/format';

export default function ViewTransformationPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transformation, setTransformation] = useState<Transformation | null>(null);
  const [items, setItems] = useState<(TransformationItem & { product: Product })[]>([]);
  const [targetProduct, setTargetProduct] = useState<Product | null>(null);
  const [branchName, setBranchName] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const router = useRouter();
  const params = useParams();
  const transformationId = params?.id as string;
  
  useEffect(() => {
    const fetchTransformationDetails = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const supabase = createClient();
        
        // Fetch transformation details
        const { data: transformationData, error: transformationError } = await supabase
          .from('transformations')
          .select('*')
          .eq('id', transformationId)
          .single();
          
        if (transformationError) {
          throw new Error(transformationError.message);
        }
        
        // Fetch branch name
        const { data: branchData, error: branchError } = await supabase
          .from('branches')
          .select('name')
          .eq('id', transformationData.branch_id)
          .single();
          
        if (branchError) {
          throw new Error(branchError.message);
        }
        
        // Fetch user name
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', transformationData.created_by)
          .single();
          
        if (userError && userError.code !== 'PGRST116') { // Ignore if user not found
          throw new Error(userError.message);
        }
        
        // Fetch target product details
        const { data: targetProductData, error: targetProductError } = await supabase
          .from('products')
          .select('*')
          .eq('id', transformationData.target_product_id)
          .single();
          
        if (targetProductError) {
          throw new Error(targetProductError.message);
        }
        
        // Fetch transformation items with product details
        const { data: itemsData, error: itemsError } = await supabase
          .from('transformation_items')
          .select(`
            *,
            product:product_id (*)
          `)
          .eq('transformation_id', transformationId);
          
        if (itemsError) {
          throw new Error(itemsError.message);
        }
        
        setTransformation(transformationData);
        setBranchName(branchData.name);
        setUserName(userData?.full_name || 'غير معروف');
        setTargetProduct(targetProductData);
        setItems(itemsData || []);
      } catch (err: any) {
        setError(err.message || 'حدث خطأ أثناء جلب بيانات عملية التحويل');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (transformationId) {
      fetchTransformationDetails();
    }
  }, [transformationId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !transformation || !targetProduct) {
    return (
      <div className="p-6">
        <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900 dark:text-red-100">
          {error || 'لم يتم العثور على عملية التحويل'}
        </div>
        <button
          onClick={() => router.push('/dashboard/transformations')}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          العودة إلى قائمة عمليات التحويل
        </button>
      </div>
    );
  }

  return (
    <RoleGuard allowedRoles={['admin', 'branch_manager']}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">تفاصيل عملية التصنيع</h1>
          <button
            onClick={() => router.push('/dashboard/transformations')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            العودة إلى القائمة
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">معلومات عملية التصنيع</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">رقم المرجع</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{transformation.reference_number}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">الفرع</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{branchName}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">تاريخ العملية</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{formatDate(transformation.created_at)}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">بواسطة</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{userName}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">المنتج النهائي</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{targetProduct.name}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">الكمية المنتجة</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{transformation.target_quantity} {targetProduct.unit}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">التكلفة الإجمالية</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{formatCurrency(transformation.total_cost)} ريال</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">تكلفة الوحدة</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {formatCurrency(transformation.total_cost / transformation.target_quantity)} ريال / {targetProduct.unit}
              </p>
            </div>
          </div>
          
          {transformation.notes && (
            <div className="mt-6">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">ملاحظات</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{transformation.notes}</p>
            </div>
          )}
        </div>
        
        <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">المواد الخام المستخدمة</h2>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    المادة الخام
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    SKU
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    الكمية المستخدمة
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    تكلفة الوحدة
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    التكلفة الإجمالية
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
                      {formatCurrency(item.cost_per_unit)} ريال
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatCurrency(item.total_cost)} ريال
                    </td>
                  </tr>
                ))}
                
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      لا توجد مواد خام مستخدمة في هذه العملية
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-left text-sm font-bold text-gray-900 dark:text-white">
                    إجمالي تكلفة المواد الخام:
                  </td>
                  <td className="px-6 py-4 text-left text-sm font-bold text-gray-900 dark:text-white">
                    {formatCurrency(transformation.total_cost)} ريال
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
