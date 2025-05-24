import { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Product, Branch, InventoryItem } from '@/types';
import RoleGuard from '@/components/auth/role-guard';
import { useAuthStore } from '@/lib/store/auth';
import { generateInvoiceNumber } from '@/lib/utils/format';

const transformationItemSchema = z.object({
  product_id: z.string().min(1, 'المنتج مطلوب'),
  quantity: z.number().min(0.01, 'الكمية يجب أن تكون أكبر من صفر'),
  cost_per_unit: z.number().min(0),
  total_cost: z.number().min(0),
});

const transformationSchema = z.object({
  reference_number: z.string().min(1, 'رقم المرجع مطلوب'),
  branch_id: z.string().min(1, 'الفرع مطلوب'),
  target_product_id: z.string().min(1, 'المنتج النهائي مطلوب'),
  target_quantity: z.number().min(0.01, 'الكمية المنتجة يجب أن تكون أكبر من صفر'),
  notes: z.string().optional(),
  source_items: z.array(transformationItemSchema).min(1, 'يجب إضافة مادة خام واحدة على الأقل'),
});

type TransformationItemFormValues = z.infer<typeof transformationItemSchema>;
type TransformationFormValues = z.infer<typeof transformationSchema>;

export default function AddTransformationPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [inventory, setInventory] = useState<(InventoryItem & { product: Product })[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const router = useRouter();
  const { user } = useAuthStore();
  
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TransformationFormValues>({
    resolver: zodResolver(transformationSchema),
    defaultValues: {
      reference_number: `TRANS-${generateInvoiceNumber().split('-')[1]}`,
      branch_id: '',
      target_product_id: '',
      target_quantity: 1,
      notes: '',
      source_items: [
        {
          product_id: '',
          quantity: 1,
          cost_per_unit: 0,
          total_cost: 0,
        },
      ],
    },
  });
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'source_items',
  });
  
  const watchSourceItems = watch('source_items');
  const watchBranchId = watch('branch_id');
  
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
  
  // حساب إجمالي التكلفة
  useEffect(() => {
    let cost = 0;
    
    watchSourceItems.forEach(item => {
      if (item.total_cost) {
        cost += item.total_cost;
      }
    });
    
    setTotalCost(cost);
  }, [watchSourceItems]);
  
  // تحديث قائمة المخزون المتاح عند تغيير الفرع
  const getAvailableInventory = (productId: string) => {
    if (!watchBranchId) return 0;
    
    const inventoryItem = inventory.find(
      item => item.product_id === productId && item.branch_id === watchBranchId
    );
    
    return inventoryItem ? inventoryItem.quantity : 0;
  };
  
  // الحصول على تكلفة الوحدة من المخزون
  const getProductCostPerUnit = (productId: string) => {
    if (!watchBranchId) return 0;
    
    const inventoryItem = inventory.find(
      item => item.product_id === productId && item.branch_id === watchBranchId
    );
    
    return inventoryItem ? inventoryItem.average_cost : 0;
  };
  
  // تحديث تكلفة العنصر عند تغيير المنتج أو الكمية
  const updateItemCost = (index: number) => {
    const item = watchSourceItems[index];
    if (item.product_id && watchBranchId) {
      const costPerUnit = getProductCostPerUnit(item.product_id);
      setValue(`source_items.${index}.cost_per_unit`, costPerUnit);
      
      if (item.quantity) {
        const totalCost = costPerUnit * item.quantity;
        setValue(`source_items.${index}.total_cost`, totalCost);
      }
    }
  };
  
  const handleAddItem = () => {
    append({
      product_id: '',
      quantity: 1,
      cost_per_unit: 0,
      total_cost: 0,
    });
  };
  
  const onSubmit = async (data: TransformationFormValues) => {
    setIsSaving(true);
    setError(null);
    
    try {
      // التحقق من توفر المخزون الكافي
      for (const item of data.source_items) {
        const availableQuantity = getAvailableInventory(item.product_id);
        if (item.quantity > availableQuantity) {
          const productName = products.find(p => p.id === item.product_id)?.name || 'غير معروف';
          throw new Error(`الكمية المطلوبة من ${productName} غير متوفرة في المخزون. المتاح: ${availableQuantity}`);
        }
      }
      
      const supabase = createClient();
      
      // إنشاء عملية التحويل
      const { data: transformationData, error: transformationError } = await supabase
        .from('transformations')
        .insert({
          reference_number: data.reference_number,
          branch_id: data.branch_id,
          target_product_id: data.target_product_id,
          target_quantity: data.target_quantity,
          total_cost: totalCost,
          notes: data.notes || null,
          created_by: user?.id,
        })
        .select()
        .single();
        
      if (transformationError) {
        throw new Error(transformationError.message);
      }
      
      // إنشاء عناصر التحويل
      const transformationItems = data.source_items.map(item => ({
        transformation_id: transformationData.id,
        product_id: item.product_id,
        quantity: item.quantity,
        cost_per_unit: item.cost_per_unit,
        total_cost: item.total_cost,
      }));
      
      const { error: itemsError } = await supabase
        .from('transformation_items')
        .insert(transformationItems);
        
      if (itemsError) {
        throw new Error(itemsError.message);
      }
      
      // تحديث المخزون سيتم تلقائياً عبر Trigger في قاعدة البيانات
      
      router.push('/dashboard/transformations');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إنشاء عملية التحويل');
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">إضافة عملية تصنيع جديدة</h1>
        </div>
        
        {error && (
          <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900 dark:text-red-100">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">معلومات عملية التصنيع</h2>
            
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
                <label htmlFor="target_product_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  المنتج النهائي
                </label>
                <select
                  id="target_product_id"
                  {...register('target_product_id')}
                  className="w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  dir="rtl"
                >
                  <option value="">اختر المنتج النهائي</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </option>
                  ))}
                </select>
                {errors.target_product_id && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.target_product_id.message}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="target_quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  الكمية المنتجة
                </label>
                <input
                  id="target_quantity"
                  type="number"
                  step="0.01"
                  {...register('target_quantity', { valueAsNumber: true })}
                  className="w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  dir="rtl"
                />
                {errors.target_quantity && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.target_quantity.message}</p>
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
          </div>
          
          <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">المواد الخام المستخدمة</h2>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                إضافة مادة خام
              </button>
            </div>
            
            {errors.source_items && (
              <p className="mt-1 mb-4 text-sm text-red-600 dark:text-red-400">{errors.source_items.message}</p>
            )}
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      المادة الخام
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      الكمية المتاحة
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
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      الإجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
                  {fields.map((field, index) => (
                    <tr key={field.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          {...register(`source_items.${index}.product_id`)}
                          onChange={(e) => {
                            register(`source_items.${index}.product_id`).onChange(e);
                            updateItemCost(index);
                          }}
                          className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          dir="rtl"
                        >
                          <option value="">اختر المادة الخام</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name} ({product.sku})
                            </option>
                          ))}
                        </select>
                        {errors.source_items?.[index]?.product_id && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                            {errors.source_items[index]?.product_id?.message}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {watchSourceItems[index]?.product_id ? 
                          `${getAvailableInventory(watchSourceItems[index].product_id)} ${products.find(p => p.id === watchSourceItems[index].product_id)?.unit || ''}` : 
                          '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          step="0.01"
                          {...register(`source_items.${index}.quantity`, { valueAsNumber: true })}
                          onChange={(e) => {
                            register(`source_items.${index}.quantity`).onChange(e);
                            updateItemCost(index);
                          }}
                          className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          dir="rtl"
                        />
                        {errors.source_items?.[index]?.quantity && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                            {errors.source_items[index]?.quantity?.message}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Controller
                          control={control}
                          name={`source_items.${index}.cost_per_unit`}
                          render={({ field }) => (
                            <input
                              type="number"
                              step="0.01"
                              value={field.value}
                              readOnly
                              className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md bg-gray-100 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                              dir="rtl"
                            />
                          )}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Controller
                          control={control}
                          name={`source_items.${index}.total_cost`}
                          render={({ field }) => (
                            <input
                              type="number"
                              step="0.01"
                              value={field.value}
                              readOnly
                              className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md bg-gray-100 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                              dir="rtl"
                            />
                          )}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          حذف
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-left text-sm font-bold text-gray-900 dark:text-white">
                      إجمالي تكلفة المواد الخام:
                    </td>
                    <td className="px-6 py-4 text-left text-sm font-bold text-gray-900 dark:text-white">
                      {totalCost.toFixed(2)} ريال
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          
          <div className="flex justify-end space-x-4 space-x-reverse">
            <button
              type="button"
              onClick={() => router.push('/dashboard/transformations')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'جاري الحفظ...' : 'إنشاء عملية التصنيع'}
            </button>
          </div>
        </form>
      </div>
    </RoleGuard>
  );
}
