import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import RoleGuard from '@/components/auth/role-guard';

const branchSchema = z.object({
  name: z.string().min(2, 'اسم الفرع مطلوب ويجب أن يكون حرفين على الأقل'),
  location: z.string().min(2, 'موقع الفرع مطلوب ويجب أن يكون حرفين على الأقل'),
});

type BranchFormValues = z.infer<typeof branchSchema>;

export default function EditBranchPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const params = useParams();
  const branchId = params?.id as string;
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<BranchFormValues>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: '',
      location: '',
    },
  });

  useEffect(() => {
    const fetchBranch = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const supabase = createClient();
        
        const { data, error: fetchError } = await supabase
          .from('branches')
          .select('*')
          .eq('id', branchId)
          .single();
          
        if (fetchError) {
          throw new Error(fetchError.message);
        }
        
        reset({
          name: data.name,
          location: data.location,
        });
      } catch (err: any) {
        setError(err.message || 'حدث خطأ أثناء جلب بيانات الفرع');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (branchId) {
      fetchBranch();
    }
  }, [branchId, reset]);

  const onSubmit = async (data: BranchFormValues) => {
    setIsSaving(true);
    setError(null);
    
    try {
      const supabase = createClient();
      
      // تحديث الفرع في قاعدة البيانات
      const { error: updateError } = await supabase
        .from('branches')
        .update({
          name: data.name,
          location: data.location,
        })
        .eq('id', branchId);
        
      if (updateError) {
        throw new Error(updateError.message);
      }
      
      router.push('/dashboard/branches');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تحديث الفرع');
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
    <RoleGuard allowedRoles={['admin']}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">تعديل الفرع</h1>
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
