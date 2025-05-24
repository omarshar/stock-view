import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Branch } from '@/types';
import RoleGuard from '@/components/auth/role-guard';

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  useEffect(() => {
    const fetchBranches = async () => {
      setIsLoading(true);
      setError(null);
      
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
        setError(err.message || 'حدث خطأ أثناء جلب بيانات الفروع');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBranches();
  }, []);
  
  const handleDeleteBranch = async (branchId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الفرع؟')) {
      return;
    }
    
    try {
      const supabase = createClient();
      
      // التحقق من وجود مستخدمين مرتبطين بهذا الفرع
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id')
        .eq('branch_id', branchId)
        .limit(1);
        
      if (usersError) {
        throw new Error(usersError.message);
      }
      
      if (usersData && usersData.length > 0) {
        throw new Error('لا يمكن حذف هذا الفرع لأنه مرتبط بمستخدمين');
      }
      
      // التحقق من وجود مخزون مرتبط بهذا الفرع
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('inventory_items')
        .select('id')
        .eq('branch_id', branchId)
        .limit(1);
        
      if (inventoryError) {
        throw new Error(inventoryError.message);
      }
      
      if (inventoryData && inventoryData.length > 0) {
        throw new Error('لا يمكن حذف هذا الفرع لأنه يحتوي على مخزون');
      }
      
      // حذف الفرع
      const { error: deleteError } = await supabase
        .from('branches')
        .delete()
        .eq('id', branchId);
        
      if (deleteError) {
        throw new Error(deleteError.message);
      }
      
      // تحديث قائمة الفروع
      setBranches(branches.filter(branch => branch.id !== branchId));
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حذف الفرع');
    }
  };
  
  const handleEditBranch = (branchId: string) => {
    router.push(`/dashboard/branches/edit/${branchId}`);
  };

  return (
    <RoleGuard allowedRoles={['admin']}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">إدارة الفروع</h1>
          <button
            onClick={() => router.push('/dashboard/branches/add')}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            إضافة فرع جديد
          </button>
        </div>
        
        {error && (
          <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900 dark:text-red-100">
            {error}
          </div>
        )}
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    اسم الفرع
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    الموقع
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    تاريخ الإنشاء
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
                {branches.map((branch) => (
                  <tr key={branch.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {branch.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {branch.location}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(branch.created_at).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEditBranch(branch.id)}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 ml-4"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => handleDeleteBranch(branch.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
                
                {branches.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      لا توجد فروع
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
