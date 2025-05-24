import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Product, Branch, InventoryItem } from '@/types';
import RoleGuard from '@/components/auth/role-guard';
import { useAuthStore } from '@/lib/store/auth';
import { generateInvoiceNumber } from '@/lib/utils/format';

const wasteSchema = z.object({
  reference_number: z.string().min(1, 'رقم المرجع مطلوب'),
  branch_id: z.string().min(1, 'الفرع مطلوب'),
  product_id: z.string().min(1, 'المنتج مطلوب'),
  quantity: z.number().min(0.01, 'الكمية يجب أن تكون أكبر من صفر'),
  reason: z.string().min(1, 'سبب الهدر مطلوب'),
  notes: z.string().optional(),
});

type WasteFormValues = z.infer<typeof wasteSchema>;

export default function AddWastePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [inventory, setInventory] = useState<(InventoryItem & { product: Product })[]>([]);
  const [selectedProductCost, setSelectedProductCost] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const router = useRouter();
  const { user } = useAuthStore();
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<WasteFormValues>({
    resolver: zodResolver(wasteSchema),
    defaultValues: {
      reference_number: `WASTE-${generateInvoiceNumber().split('-')[1]}`,
      branch_id: '',
      product_id: '',
      quantity: 1,
      reason: '',
      notes: '',
    },
  });
  
  const watchBranchId = watch('branch_id');
  const watchProductId = watch('product_id');
  const watchQuantity = watch('quantity');
  
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const supabase = createClient();
        
        // Fetch products
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('*')
          .order('name', { ascending: true });
          
        if (productsError) {
          throw new Error(productsError.message);
        }
        
        // Fetch branches
        const { data: branchesData, error: branchesError } = await supabase
          .from('branches')
          .select('*')
          .order('name', { ascending: true });
          
        if (branchesError) {
          throw new Error(branchesError.message);
        }
        
        // Fetch inventory with product details
        const { data: inventoryData, error: inventoryError } = await supabase
          .from('inventory_items')
          .select(`
            *,
            product:product_id (*)
          `);
          
        if (inventoryError) {
          throw new Error(inventoryError.message);
        }
        
        setProducts(productsData || []);
        setBranches(branchesData || []);
        setInventory(inventoryData || []);
        
        // Set default branch for branch manager
        if (user?.role === 'branch_manager' && user?.branch_id) {
          setValue('branch_id', user.branch_id);
        }
      } catch (err: any) {
        setError(err.message || 'حدث خطأ أثناء جلب البيانات');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [setValue, user]);
  
  // تحديث تكلفة المنتج عند تغيير المنتج أو الفرع
  useEffect(() => {
    if (watchProductId && watchBranchId) {
      const inventoryItem = inventory.find(
        item => item.product_id === watchProductId && item.branch_id === watchBranchId
      );
      
      if (inventoryItem) {
        setSelectedProductCost(inventoryItem.average_cost);
      } else {
        setSelectedProductCost(0);
      }
    } else {
      setSelectedProductCost(0);
    }
  }, [watchProductId, watchBranchId, inventory]);
  
  // حساب التكلفة الإجمالية
  useEffect(() => {
    if (watchQuantity && selectedProductCost) {
      setTotalCost(watchQuantity * selectedProductCost);
    } else {
      setTotalCost(0);
    }
  }, [watchQuantity, selectedProductCost]);
  
  // الحصول على الكمية المتاحة في المخزون
  const getAvailableInventory = () => {
    if (!watchProductId || !watchBranchId) return 0;
    
    const inventoryItem = inventory.find(
      item => item.product_id === watchProductId && item.branch_id === watchBranchId
    );
    
    return inventoryItem ? inventoryItem.quantity : 0;
  };
  
  // الحصول على وحدة المنتج
  const getProductUnit = () => {
    if (!watchProductId) return '';
    
    const product = products.find(p => p.id === watchProductId);
    return product ? product.unit : '';
  };
  
  const onSubmit = async (data: WasteFormValues) => {
    setIsSaving(true);
    setError(null);
    
    try {
      // التحقق من توفر المخزون الكافي
      const availableQuantity = getAvailableInventory();
      if (data.quantity > availableQuantity) {
        throw new Error(`الكمية المطلوبة غير متوفرة في المخزون. المتاح: ${availableQuantity} ${getProductUnit()}`);
      }
      
      const supabase = createClient();
      
      // إنشاء سجل الهدر
      const { error: wasteError } = await supabase
        .from('waste')
        .insert({
          reference_number: data.reference_number,
          branch_id: data.branch_id,
          product_id: data.product_id,
          quantity: data.quantity,
          cost: totalCost,
          reason: data.reason,
          notes: data.notes || null,
          created_by: user?.id,
        });
        
      if (wasteError) {
        throw new Error(wasteError.message);
      }
      
      // تحديث المخزون سيتم تلقائياً عبر Trigger في قاعدة البيانات
      
      router.push('/dashboard/waste');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إنشاء سجل الهدر');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <RoleGuard allowedRoles={['admin', 'branch_manager']}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">إضافة سجل هدر جديد</h1>
        </div>
        
        {error && (
          <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900 dark:text-red-100">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">معلومات الهدر</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="reference_number" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  رقم المرجع
                </label>
                <input
                  id="reference_number"
                  type="text"
                  {...register('reference_number')}
                  className="w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  dir="rtl"
                />
                {errors.reference_number && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.reference_number.message}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="branch_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  الفرع
                </label>
                <select
                  id="branch_id"
                  {...register('branch_id')}
                  className="w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  dir="rtl"
                  disabled={user?.role === 'branch_manager'}
                >
                  <option value="">اختر الفرع</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
                {errors.branch_id && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.branch_id.message}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="product_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  المنتج
                </label>
                <select
                  id="product_id"
                  {...register('product_id')}
                  className="w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  dir="rtl"
                >
                  <option value="">اختر المنتج</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </option>
                  ))}
                </select>
                {errors.product_id && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.product_id.message}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  الكمية المهدرة
                </label>
                <div className="flex items-center">
                  <input
                    id="quantity"
                    type="number"
                    step="0.01"
                    {...register('quantity', { valueAsNumber: true })}
                    className="w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    dir="rtl"
                  />
                  <span className="mr-2 mt-1 text-gray-500 dark:text-gray-400">
                    {getProductUnit()}
                  </span>
                </div>
                {errors.quantity && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.quantity.message}</p>
                )}
                {watchProductId && watchBranchId && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    المتاح في المخزون: {getAvailableInventory()} {getProductUnit()}
                  </p>
                )}
              </div>
              
              <div>
                <label htmlFor="reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  سبب الهدر
                </label>
                <select
                  id="reason"
                  {...register('reason')}
                  className="w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  dir="rtl"
                >
                  <option value="">اختر السبب</option>
                  <option value="انتهاء الصلاحية">انتهاء الصلاحية</option>
                  <option value="تلف">تلف</option>
                  <option value="كسر">كسر</option>
                  <option value="فقدان">فقدان</option>
                  <option value="سرقة">سرقة</option>
                  <option value="أخرى">أخرى</option>
                </select>
                {errors.reason && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.reason.message}</p>
                )}
              </div>
              
              <div className="md:col-span-2">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  ملاحظات (اختياري)
                </label>
                <textarea
                  id="notes"
                  {...register('notes')}
                  rows={3}
                  className="w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  dir="rtl"
                />
                {errors.notes && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.notes.message}</p>
                )}
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">ملخص التكلفة</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">تكلفة الوحدة</p>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">{selectedProductCost.toFixed(2)} ريال</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">الكمية المهدرة</p>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">{watchQuantity || 0} {getProductUnit()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">إجمالي التكلفة</p>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">{totalCost.toFixed(2)} ريال</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-4 space-x-reverse">
            <button
              type="button"
              onClick={() => router.push('/dashboard/waste')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'جاري الحفظ...' : 'إنشاء سجل الهدر'}
            </button>
          </div>
        </form>
      </div>
    </RoleGuard>
  );
}
