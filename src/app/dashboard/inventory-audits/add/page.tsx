import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Branch } from '@/types';
import RoleGuard from '@/components/auth/role-guard';
import { useAuthStore } from '@/lib/store/auth';
import { generateInvoiceNumber } from '@/lib/utils/format';

const auditSchema = z.object({
  reference_number: z.string().min(1, 'رقم المرجع مطلوب'),
  branch_id: z.string().min(1, 'الفرع مطلوب'),
  audit_date: z.string().min(1, 'تاريخ الجرد مطلوب'),
  notes: z.string().optional(),
});

type AuditFormValues = z.infer<typeof auditSchema>;

export default function AddInventoryAuditPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const router = useRouter();
  const { user } = useAuthStore();
  
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<AuditFormValues>({
    resolver: zodResolver(auditSchema),
    defaultValues: {
      reference_number: `AUDIT-${generateInvoiceNumber().split('-')[1]}`,
      branch_id: '',
      audit_date: new Date().toISOString().split('T')[0],
      notes: '',
    },
  });
  
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const supabase = createClient();
        
        // Fetch branches
        const { data: branchesData, error: branchesError } = await supabase
          .from('branches')
          .select('*')
          .order('name', { ascending: true });
          
        if (branchesError) {
          throw new Error(branchesError.message);
        }
        
        setBranches(branchesData || []);
        
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
  
  const onSubmit = async (data: AuditFormValues) => {
    setIsSaving(true);
    setError(null);
    
    try {
      const supabase = createClient();
      
      // التحقق من عدم وجود جرد آخر للفرع في نفس التاريخ
      const { data: existingAudit, error: checkError } = await supabase
        .from('inventory_audits')
        .select('id')
        .eq('branch_id', data.branch_id)
        .eq('audit_date', data.audit_date)
        .not('status', 'eq', 'cancelled');
        
      if (checkError) {
        throw new Error(checkError.message);
      }
      
      if (existingAudit && existingAudit.length > 0) {
        throw new Error('يوجد بالفعل جرد لهذا الفرع في نفس التاريخ');
      }
      
      // إنشاء جرد جديد
      const { data: auditData, error: auditError } = await supabase
        .from('inventory_audits')
        .insert({
          reference_number: data.reference_number,
          branch_id: data.branch_id,
          audit_date: data.audit_date,
          status: 'draft',
          notes: data.notes || null,
          created_by: user?.id,
        })
        .select()
        .single();
        
      if (auditError) {
        throw new Error(auditError.message);
      }
      
      // إنشاء عناصر الجرد (سيتم تنفيذه في الخطوة التالية)
      router.push(`/dashboard/inventory-audits/edit/${auditData.id}`);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إنشاء الجرد');
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">إنشاء جرد مخزون جديد</h1>
        </div>
        
        {error && (
          <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900 dark:text-red-100">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">معلومات الجرد</h2>
            
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
                <label htmlFor="audit_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  تاريخ الجرد
                </label>
                <input
                  id="audit_date"
                  type="date"
                  {...register('audit_date')}
                  className="w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  dir="rtl"
                />
                {errors.audit_date && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.audit_date.message}</p>
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
            
            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900 rounded-md">
              <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-100 mb-2">ملاحظة هامة</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-200">
                بعد إنشاء الجرد، ستتمكن من إدخال الكميات الفعلية للمنتجات في المخزون. سيقوم النظام بمقارنة الكميات الفعلية مع الكميات المتوقعة وتسجيل الفروقات.
              </p>
            </div>
          </div>
          
          <div className="flex justify-end space-x-4 space-x-reverse">
            <button
              type="button"
              onClick={() => router.push('/dashboard/inventory-audits')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'جاري الإنشاء...' : 'إنشاء الجرد'}
            </button>
          </div>
        </form>
      </div>
    </RoleGuard>
  );
}
