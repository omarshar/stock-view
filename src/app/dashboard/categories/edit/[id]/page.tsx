'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import RoleGuard from '@/components/auth/role-guard';

const categorySchema = z.object({
  name: z.string().min(2, 'اسم التصنيف مطلوب ويجب أن يكون حرفين على الأقل'),
  description: z.string().optional(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

export default function EditCategoryPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const params = useParams();
  const categoryId = params?.id as string;
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  useEffect(() => {
    const fetchCategory = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const supabase = createClient();
        
        const { data, error: fetchError } = await supabase
          .from('categories')
          .select('*')
          .eq('id', categoryId)
          .single();
          
        if (fetchError) {
          throw new Error(fetchError.message);
        }
        
        reset({
          name: data.name,
          description: data.description || '',
        });
      } catch (err: any) {
        setError(err.message || 'حدث خطأ أثناء جلب بيانات التصنيف');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (categoryId) {
      fetchCategory();
    }
  }, [categoryId, reset]);

  const onSubmit = async (data: CategoryFormValues) => {
    setIsSaving(true);
    setError(null);
    
    try {
      const supabase = createClient();
      
      // تحديث التصنيف في قاعدة البيانات
      const { error: updateError } = await supabase
        .from('categories')
        .update({
          name: data.name,
          description: data.description || null,
        })
        .eq('id', categoryId);
        
      if (updateError) {
        throw new Error(updateError.message);
      }
      
      router.push('/dashboard/categories');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تحديث التصنيف');
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">تعديل التصنيف</h1>
        </div>
        
        {error && (
          <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900 dark:text-red-100">
            {error}
          </div>
        )}
        
        <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                اسم التصنيف
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
            
            <div className="flex justify-end space-x-4 space-x-reverse">
              <button
                type="button"
                onClick={() => router.push('/dashboard/categories')}
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
