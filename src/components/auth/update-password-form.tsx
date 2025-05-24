import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';

const updatePasswordSchema = z.object({
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  confirmPassword: z.string().min(6, 'تأكيد كلمة المرور مطلوب'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'كلمات المرور غير متطابقة',
  path: ['confirmPassword'],
});

type UpdatePasswordFormValues = z.infer<typeof updatePasswordSchema>;

export default function UpdatePasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdatePasswordFormValues>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: UpdatePasswordFormValues) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const supabase = createClient();
      
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.password,
      });
      
      if (updateError) {
        throw new Error(updateError.message);
      }
      
      setSuccess('تم تحديث كلمة المرور بنجاح');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تحديث كلمة المرور');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md dark:bg-gray-800">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">تحديث كلمة المرور</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">أدخل كلمة المرور الجديدة</p>
      </div>
      
      {error && (
        <div className="p-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900 dark:text-red-100">
          {error}
        </div>
      )}
      
      {success && (
        <div className="p-4 text-sm text-green-700 bg-green-100 rounded-lg dark:bg-green-900 dark:text-green-100">
          {success}
        </div>
      )}
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            كلمة المرور الجديدة
          </label>
          <input
            id="password"
            type="password"
            {...register('password')}
            className="w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            dir="rtl"
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.password.message}</p>
          )}
        </div>
        
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            تأكيد كلمة المرور
          </label>
          <input
            id="confirmPassword"
            type="password"
            {...register('confirmPassword')}
            className="w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            dir="rtl"
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.confirmPassword.message}</p>
          )}
        </div>
        
        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
          </button>
        </div>
      </form>
    </div>
  );
}
