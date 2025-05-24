import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Waste, Product } from '@/types';
import RoleGuard from '@/components/auth/role-guard';
import { formatCurrency, formatDate } from '@/lib/utils/format';

export default function ViewWastePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [waste, setWaste] = useState<Waste | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [branchName, setBranchName] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const router = useRouter();
  const params = useParams();
  const wasteId = params?.id as string;
  
  useEffect(() => {
    const fetchWasteDetails = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const supabase = createClient();
        
        // Fetch waste details
        const { data: wasteData, error: wasteError } = await supabase
          .from('waste')
          .select('*')
          .eq('id', wasteId)
          .single();
          
        if (wasteError) {
          throw new Error(wasteError.message);
        }
        
        // Fetch branch name
        const { data: branchData, error: branchError } = await supabase
          .from('branches')
          .select('name')
          .eq('id', wasteData.branch_id)
          .single();
          
        if (branchError) {
          throw new Error(branchError.message);
        }
        
        // Fetch user name
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', wasteData.created_by)
          .single();
          
        if (userError && userError.code !== 'PGRST116') { // Ignore if user not found
          throw new Error(userError.message);
        }
        
        // Fetch product details
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select('*')
          .eq('id', wasteData.product_id)
          .single();
          
        if (productError) {
          throw new Error(productError.message);
        }
        
        setWaste(wasteData);
        setBranchName(branchData.name);
        setUserName(userData?.full_name || 'غير معروف');
        setProduct(productData);
      } catch (err: any) {
        setError(err.message || 'حدث خطأ أثناء جلب بيانات سجل الهدر');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (wasteId) {
      fetchWasteDetails();
    }
  }, [wasteId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !waste || !product) {
    return (
      <div className="p-6">
        <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900 dark:text-red-100">
          {error || 'لم يتم العثور على سجل الهدر'}
        </div>
        <button
          onClick={() => router.push('/dashboard/waste')}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          العودة إلى قائمة سجلات الهدر
        </button>
      </div>
    );
  }

  return (
    <RoleGuard allowedRoles={['admin', 'branch_manager']}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">تفاصيل سجل الهدر</h1>
          <button
            onClick={() => router.push('/dashboard/waste')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            العودة إلى القائمة
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">معلومات سجل الهدر</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">رقم المرجع</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{waste.reference_number}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">الفرع</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{branchName}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">تاريخ التسجيل</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{formatDate(waste.created_at)}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">بواسطة</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{userName}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">المنتج</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{product.name}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">SKU</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{product.sku}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">الكمية المهدرة</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{waste.quantity} {product.unit}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">سبب الهدر</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{waste.reason}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">تكلفة الوحدة</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {formatCurrency(waste.cost / waste.quantity)} ريال / {product.unit}
              </p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">إجمالي التكلفة</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{formatCurrency(waste.cost)} ريال</p>
            </div>
          </div>
          
          {waste.notes && (
            <div className="mt-6">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">ملاحظات</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{waste.notes}</p>
            </div>
          )}
        </div>
        
        <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">تأثير الهدر على المخزون</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-4 bg-red-50 dark:bg-red-900 rounded-lg">
              <p className="text-sm font-medium text-red-500 dark:text-red-300">الكمية المهدرة</p>
              <p className="text-2xl font-bold text-red-700 dark:text-red-100">- {waste.quantity} {product.unit}</p>
            </div>
            
            <div className="p-4 bg-red-50 dark:bg-red-900 rounded-lg">
              <p className="text-sm font-medium text-red-500 dark:text-red-300">التكلفة المالية</p>
              <p className="text-2xl font-bold text-red-700 dark:text-red-100">- {formatCurrency(waste.cost)} ريال</p>
            </div>
            
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">تاريخ التأثير على المخزون</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{formatDate(waste.created_at)}</p>
            </div>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
