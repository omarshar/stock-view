import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { InventoryItem, Product } from '@/types';
import RoleGuard from '@/components/auth/role-guard';

const adjustInventorySchema = z.object({
  quantity: z.number().min(0, 'الكمية يجب أن تكون 0 أو أكثر'),
  reason: z.string().min(3, 'سبب التعديل مطلوب ويجب أن يكون 3 أحرف على الأقل'),
});

type AdjustInventoryFormValues = z.infer<typeof adjustInventorySchema>;

export default function AdjustInventoryPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inventoryItem, setInventoryItem] = useState<InventoryItem | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const router = useRouter();
  const params = useParams();
  const inventoryItemId = params?.id as string;
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<AdjustInventoryFormValues>({
    resolver: zodResolver(adjustInventorySchema),
    defaultValues: {
      quantity: 0,
      reason: '',
    },
  });

  useEffect(() => {
    const fetchInventoryItem = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const supabase = createClient();
        
        // Fetch inventory item
        const { data: itemData, error: itemError } = await supabase
          .from('inventory_items')
          .select('*')
          .eq('id', inventoryItemId)
          .single();
          
        if (itemError) {
          throw new Error(itemError.message);
        }
        
        // Fetch product details
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select('*')
          .eq('id', itemData.product_id)
          .single();
          
        if (productError) {
          throw new Error(productError.message);
        }
        
        setInventoryItem(itemData);
        setProduct(productData);
        
        reset({
          quantity: itemData.quantity,
          reason: '',
        });
      } catch (err: any) {
        setError(err.message || 'حدث خطأ أثناء جلب بيانات المخزون');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (inventoryItemId) {
      fetchInventoryItem();
    }
  }, [inventoryItemId, reset]);

  const onSubmit = async (data: AdjustInventoryFormValues) => {
    if (!inventoryItem) return;
    
    setIsSaving(true);
    setError(null);
    
    try {
      const supabase = createClient();
      
      // تسجيل تعديل المخزون
      const { error: adjustmentError } = await supabase
        .from('inventory_adjustments')
        .insert({
          inventory_item_id: inventoryItemId,
          previous_quantity: inventoryItem.quantity,
          new_quantity: data.quantity,
          reason: data.reason,
        });
        
      if (adjustmentError) {
        throw new Error(adjustmentError.message);
      }
      
      // تحديث كمية المخزون
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({
          quantity: data.quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', inventoryItemId);
        
      if (updateError) {
        throw new Error(updateError.message);
      }
      
      router.push('/dashboard/inventory');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تعديل المخزون');
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">تعديل كمية المخزون</h1>
        </div>
        
        {error && (
          <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900 dark:text-red-100">
            {error}
          </div>
        )}
        
        {product && (
          <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">معلومات المنتج</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">اسم المنتج</p>
                <p className="text-lg font-medium text-gray-900 dark:text-white">{product.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">SKU</p>
                <p className="text-lg font-medium text-gray-900 dark:text-white">{product.sku}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">وحدة القياس</p>
                <p className="text-lg font-medium text-gray-900 dark:text-white">{product.unit}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">الكمية الحالية</p>
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  {inventoryItem?.quantity} {product.unit}
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                الكمية الجديدة
              </label>
              <input
                id="quantity"
                type="number"
                step="0.01"
                {...register('quantity', { valueAsNumber: true })}
                className="w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                dir="rtl"
              />
              {errors.quantity && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.quantity.message}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                سبب التعديل
              </label>
              <textarea
                id="reason"
                {...register('reason')}
                rows={3}
                className="w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                dir="rtl"
              />
              {errors.reason && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.reason.message}</p>
              )}
            </div>
            
            <div className="flex justify-end space-x-4 space-x-reverse">
              <button
                type="button"
                onClick={() => router.push('/dashboard/inventory')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </RoleGuard>
  );
}
