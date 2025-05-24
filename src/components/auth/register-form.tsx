import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';

const registerSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صالح'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  full_name: z.string().min(3, 'الاسم الكامل مطلوب'),
  role: z.enum(['admin', 'branch_manager', 'user'], {
    errorMap: () => ({ message: 'يرجى اختيار دور صالح' }),
  }),
  branch_id: z.string().optional(),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      full_name: '',
      role: 'user',
    },
  });

  const selectedRole = watch('role');

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const supabase = createClient();
      
      // Register the user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.full_name,
          },
        },
      });
      
      if (authError) {
        throw new Error(authError.message);
      }
      
      if (authData?.user) {
        // Create user profile with role information
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: data.email,
            full_name: data.full_name,
            role: data.role,
            branch_id: data.branch_id || null,
          });
          
        if (profileError) {
          throw new Error(profileError.message);
        }
        
        setSuccess('تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.');
        setTimeout(() => {
          router.push('/auth/login');
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إنشاء الحساب');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md dark:bg-gray-800">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">إنشاء حساب جديد</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">أدخل بياناتك لإنشاء حساب جديد</p>
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
          <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            الاسم الكامل
          </label>
          <input
            id="full_name"
            type="text"
            {...register('full_name')}
            className="w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            dir="rtl"
          />
          {errors.full_name && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.full_name.message}</p>
          )}
        </div>
        
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            البريد الإلكتروني
          </label>
          <input
            id="email"
            type="email"
            {...register('email')}
            className="w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            dir="rtl"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email.message}</p>
          )}
        </div>
        
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            كلمة المرور
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
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            الدور
          </label>
          <select
            id="role"
            {...register('role')}
            className="w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            dir="rtl"
          >
            <option value="admin">مشرف</option>
            <option value="branch_manager">مدير فرع</option>
            <option value="user">مستخدم</option>
          </select>
          {errors.role && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.role.message}</p>
          )}
        </div>
        
        {(selectedRole === 'branch_manager' || selectedRole === 'user') && (
          <div>
            <label htmlFor="branch_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              الفرع
            </label>
            <select
              id="branch_id"
              {...register('branch_id')}
              className="w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              dir="rtl"
            >
              <option value="">اختر الفرع</option>
              {/* سيتم تحميل الفروع من قاعدة البيانات */}
              <option value="branch-1">الفرع الرئيسي</option>
              <option value="branch-2">فرع المدينة</option>
            </select>
            {errors.branch_id && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.branch_id.message}</p>
            )}
          </div>
        )}
        
        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'جاري إنشاء الحساب...' : 'إنشاء حساب'}
          </button>
        </div>
      </form>
    </div>
  );
}
