import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Category, ProductType, Product } from '@/types';
import RoleGuard from '@/components/auth/role-guard';

const productSchema = z.object({
  name: z.string().min(3, 'اسم المنتج مطلوب ويجب أن يكون 3 أحرف على الأقل'),
  barcode: z.string().optional(),
  description: z.string().optional(),
  category_id: z.string().min(1, 'يرجى اختيار تصنيف'),
  product_type_id: z.string().min(1, 'يرجى اختيار نوع المنتج'),
  unit: z.string().min(1, 'وحدة القياس مطلوبة'),
});

type ProductFormValues = z.infer<typeof productSchema>;

export default function EditProductPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const router = useRouter();
  const params = useParams();
  const productId = params?.id as string;
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      barcode: '',
      description: '',
      unit: 'قطعة',
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const supabase = createClient();
        
        // Fetch product
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .single();
          
        if (productError) {
          throw new Error(productError.message);
        }
        
        // Fetch categories
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('categories')
          .select('*')
          .order('name', { ascending: true });
          
        if (categoriesError) {
          throw new Error(categoriesError.message);
        }
        
        // Fetch product types
        const { data: typesData, error: typesError } = await supabase
          .from('product_types')
          .select('*')
          .order('name', { ascending: true });
          
        if (typesError) {
          throw new Error(typesError.message);
        }
        
        setProduct(productData);
        setCategories(categoriesData || []);
        setProductTypes(typesData || []);
        
        // Set form values
        reset({
          name: productData.name,
          barcode: productData.barcode || '',
          description: productData.description || '',
          category_id: productData.category_id,
          product_type_id: productData.product_type_id,
          unit: productData.unit,
        });
      } catch (err: any) {
        setError(err.message || 'حدث خطأ أثناء جلب بيانات المنتج');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (productId) {
      fetchData();
    }
  }, [productId, reset]);

  const onSubmit = async (data: ProductFormValues) => {
    setIsSaving(true);
    setError(null);
    
    try {
      const supabase = createClient();
      
      // تحديث المنتج في قاعدة البيانات
      const { error: updateError } = await supabase
        .from('products')
        .update({
          name: data.name,
          barcode: data.barcode || null,
          description: data.description || null,
          category_id: data.category_id,
          product_type_id: data.product_type_id,
          unit: data.unit,
        })
        .eq('id', productId);
        
      if (updateError) {
        throw new Error(updateError.message);
      }
      
      router.push('/dashboard/products');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تحديث المنتج');
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">تعديل المنتج</h1>
        </div>
        
        {error && (
          <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900 dark:text-red-100">
            {error}
          </div>
        )}
        
        <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  اسم المنتج
                </label>
                <input
                  id="name"
                  type="text"
                  {...register('name')}
                  className="w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  dir="rtl"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name.message}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="barcode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  الباركود (اختياري)
                </label>
                <input
                  id="barcode"
                  type="text"
                  {...register('barcode')}
                  className="w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  dir="rtl"
                />
                {errors.barcode && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.barcode.message}</p>
                )}
              </div>
            </div>
            
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                الوصف (اختياري)
              </label>
              <textarea
                id="description"
                {...register('description')}
                rows={3}
                className="w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                dir="rtl"
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.description.message}</p>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  التصنيف
                </label>
                <select
                  id="category_id"
                  {...register('category_id')}
                  className="w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  dir="rtl"
                >
                  <option value="">اختر التصنيف</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {errors.category_id && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.category_id.message}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="product_type_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  نوع المنتج
                </label>
                <select
                  id="product_type_id"
                  {...register('product_type_id')}
                  className="w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  dir="rtl"
                >
                  <option value="">اختر نوع المنتج</option>
                  {productTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
                {errors.product_type_id && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.product_type_id.message}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="unit" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  وحدة القياس
                </label>
                <select
                  id="unit"
                  {...register('unit')}
                  className="w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  dir="rtl"
                >
                  <option value="قطعة">قطعة</option>
                  <option value="كيلوجرام">كيلوجرام</option>
                  <option value="جرام">جرام</option>
                  <option value="لتر">لتر</option>
                  <option value="مليلتر">مليلتر</option>
                  <option value="متر">متر</option>
                  <option value="سنتيمتر">سنتيمتر</option>
                  <option value="علبة">علبة</option>
                  <option value="كرتون">كرتون</option>
                </select>
                {errors.unit && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.unit.message}</p>
                )}
              </div>
            </div>
            
            <div className="flex justify-end space-x-4 space-x-reverse">
              <button
                type="button"
                onClick={() => router.push('/dashboard/products')}
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
