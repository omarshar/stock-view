import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import RoleGuard from '@/components/auth/role-guard';

const branchSchema = z.object({
  name: z.string().min(2, 'اسم الفرع مطلوب ويجب أن يكون حرفين على الأقل'),
  location: z.string().min(2, 'موقع الفرع مطلوب ويجب أن يكون حرفين على الأقل'),
});

type BranchFormValues = z.infer<typeof branchSchema>;

export default function AddBranchPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BranchFormValues>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: '',
      location: '',
    },
  });

  const onSubmit = async (data: BranchFormValues) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const supabase = createClient();
      
      // إنشاء الفرع في قاعدة البيانات
      const { error: insertError } = await supabase
        .from('branches')
        .insert({
          name: data.name,
          location: data.location,
        });
        
      if (insertError) {
        throw new Error(insertError.message);
      }
      
      router.push('/dashboard/branches');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إنشاء الفرع');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <RoleGuard allowedRoles={['admin']}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">إضافة فرع جديد</h1>
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
                اسم الفرع
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
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                موقع الفرع
              </label>
              <input
                id="location"
                type="text"
                {...register('location')}
                className="w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                dir="rtl"
              />
              {errors.location && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.location.message}</p>
              )}
            </div>
            
            <div className="flex justify-end space-x-4 space-x-reverse">
              <button
                type="button"
                onClick={() => router.push('/dashboard/branches')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'جاري الإنشاء...' : 'إنشاء الفرع'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </RoleGuard>
  );
}
