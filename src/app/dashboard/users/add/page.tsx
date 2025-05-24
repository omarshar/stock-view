import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Branch } from '@/types';
import RoleGuard from '@/components/auth/role-guard';

const userSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صالح'),
  full_name: z.string().min(3, 'الاسم الكامل مطلوب'),
  role: z.enum(['admin', 'branch_manager', 'user'], {
    errorMap: () => ({ message: 'يرجى اختيار دور صالح' }),
  }),
  branch_id: z.string().optional(),
});

type UserFormValues = z.infer<typeof userSchema>;

export default function AddUserPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const router = useRouter();
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: '',
      full_name: '',
      role: 'user',
    },
  });

  const selectedRole = watch('role');

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const supabase = createClient();
        
        const { data, error: fetchError } = await supabase
          .from('branches')
          .select('*')
          .order('name', { ascending: true });
          
        if (fetchError) {
          throw new Error(fetchError.message);
        }
        
        setBranches(data || []);
      } catch (err: any) {
        console.error('Error fetching branches:', err.message);
      }
    };
    
    fetchBranches();
  }, []);

  const onSubmit = async (data: UserFormValues) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const supabase = createClient();
      
      // Generate a random password for the new user
      const tempPassword = Math.random().toString(36).slice(-8);
      
      // Create the user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: data.email,
        password: tempPassword,
        email_confirm: true,
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
        
        // Send password reset email to allow user to set their own password
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(data.email, {
          redirectTo: `${window.location.origin}/auth/update-password`,
        });
        
        if (resetError) {
          console.error('Error sending password reset email:', resetError.message);
        }
        
        router.push('/dashboard/users');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إنشاء المستخدم');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <RoleGuard allowedRoles={['admin']}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">إضافة مستخدم جديد</h1>
        </div>
        
        {error && (
          <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900 dark:text-red-100">
            {error}
          </div>
        )}
        
        <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
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
            )}
            
            <div className="flex justify-end space-x-4 space-x-reverse">
              <button
                type="button"
                onClick={() => router.push('/dashboard/users')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'جاري الإنشاء...' : 'إنشاء المستخدم'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </RoleGuard>
  );
}
