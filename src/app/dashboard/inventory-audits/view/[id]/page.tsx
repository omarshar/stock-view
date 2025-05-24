import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { InventoryAudit, InventoryAuditItem, Product } from '@/types';
import RoleGuard from '@/components/auth/role-guard';
import { formatDate } from '@/lib/utils/format';

export default function ViewInventoryAuditPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<InventoryAudit | null>(null);
  const [auditItems, setAuditItems] = useState<(InventoryAuditItem & { product: Product })[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredItems, setFilteredItems] = useState<(InventoryAuditItem & { product: Product })[]>([]);
  const [branchName, setBranchName] = useState('');
  const [userName, setUserName] = useState('');
  const [completedByName, setCompletedByName] = useState('');
  const router = useRouter();
  const params = useParams();
  const auditId = params?.id as string;
  
  useEffect(() => {
    const fetchAuditData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const supabase = createClient();
        
        // Fetch audit details
        const { data: auditData, error: auditError } = await supabase
          .from('inventory_audits')
          .select('*')
          .eq('id', auditId)
          .single();
          
        if (auditError) {
          throw new Error(auditError.message);
        }
        
        // Fetch branch name
        const { data: branchData, error: branchError } = await supabase
          .from('branches')
          .select('name')
          .eq('id', auditData.branch_id)
          .single();
          
        if (branchError) {
          throw new Error(branchError.message);
        }
        
        // Fetch user name
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', auditData.created_by)
          .single();
          
        if (userError && userError.code !== 'PGRST116') { // Ignore if user not found
          throw new Error(userError.message);
        }
        
        // Fetch completed by user name if available
        if (auditData.completed_by) {
          const { data: completedByData, error: completedByError } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', auditData.completed_by)
            .single();
            
          if (completedByError && completedByError.code !== 'PGRST116') { // Ignore if user not found
            throw new Error(completedByError.message);
          }
          
          setCompletedByName(completedByData?.full_name || 'غير معروف');
        }
        
        // Fetch audit items with product details
        const { data: itemsData, error: itemsError } = await supabase
          .from('inventory_audit_items')
          .select(`
            *,
            product:product_id (*)
          `)
          .eq('audit_id', auditId)
          .order('id', { ascending: true });
          
        if (itemsError) {
          throw new Error(itemsError.message);
        }
        
        setAudit(auditData);
        setBranchName(branchData.name);
        setUserName(userData?.full_name || 'غير معروف');
        setAuditItems(itemsData || []);
        
      } catch (err: any) {
        setError(err.message || 'حدث خطأ أثناء جلب بيانات الجرد');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAuditData();
  }, [auditId]);
  
  // تصفية العناصر حسب البحث
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredItems(auditItems);
    } else {
      const filtered = auditItems.filter(item => 
        item.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.product.sku.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredItems(filtered);
    }
  }, [searchTerm, auditItems]);
  
  // حساب إحصائيات الجرد
  const getAuditStats = () => {
    const stats = {
      totalItems: auditItems.length,
      itemsWithDifference: 0,
      positiveItems: 0,
      negativeItems: 0,
      noChangeItems: 0,
      totalDifference: 0,
      positiveDifference: 0,
      negativeDifference: 0,
    };
    
    auditItems.forEach(item => {
      if (item.difference !== null) {
        if (item.difference !== 0) {
          stats.itemsWithDifference++;
          
          if (item.difference > 0) {
            stats.positiveItems++;
            stats.positiveDifference += item.difference;
          } else if (item.difference < 0) {
            stats.negativeItems++;
            stats.negativeDifference += Math.abs(item.difference);
          }
          
          stats.totalDifference += item.difference;
        } else {
          stats.noChangeItems++;
        }
      }
    });
    
    return stats;
  };
  
  const stats = getAuditStats();
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return (
          <span className="px-2 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 rounded-full dark:bg-yellow-900 dark:text-yellow-100">
            مسودة
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2 py-1 text-xs font-medium text-blue-800 bg-blue-100 rounded-full dark:bg-blue-900 dark:text-blue-100">
            قيد التنفيذ
          </span>
        );
      case 'completed':
        return (
          <span className="px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full dark:bg-green-900 dark:text-green-100">
            مكتمل
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2 py-1 text-xs font-medium text-red-800 bg-red-100 rounded-full dark:bg-red-900 dark:text-red-100">
            ملغي
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs font-medium text-gray-800 bg-gray-100 rounded-full dark:bg-gray-700 dark:text-gray-100">
            {status}
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !audit) {
    return (
      <div className="p-6">
        <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900 dark:text-red-100">
          {error || 'لم يتم العثور على الجرد'}
        </div>
        <button
          onClick={() => router.push('/dashboard/inventory-audits')}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          العودة إلى قائمة الجرد
        </button>
      </div>
    );
  }

  return (
    <RoleGuard allowedRoles={['admin', 'branch_manager']}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">تفاصيل جرد المخزون</h1>
          <div className="flex space-x-2 space-x-reverse">
            {(audit.status === 'draft' || audit.status === 'in_progress') && (
              <button
                onClick={() => router.push(`/dashboard/inventory-audits/edit/${auditId}`)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                متابعة الجرد
              </button>
            )}
            <button
              onClick={() => router.push('/dashboard/inventory-audits')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              العودة إلى القائمة
            </button>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">معلومات الجرد</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">رقم المرجع</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{audit.reference_number}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">الفرع</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{branchName}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">تاريخ الجرد</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{formatDate(audit.audit_date)}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">الحالة</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {getStatusBadge(audit.status)}
              </p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">تاريخ الإنشاء</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{formatDate(audit.created_at)}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">بواسطة</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{userName}</p>
            </div>
            
            {audit.status === 'completed' && (
              <>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">تاريخ الإكمال</p>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">{formatDate(audit.completed_at || '')}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">تم الإكمال بواسطة</p>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">{completedByName}</p>
                </div>
              </>
            )}
          </div>
          
          {audit.notes && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">ملاحظات</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{audit.notes}</p>
            </div>
          )}
        </div>
        
        {audit.status === 'completed' && (
          <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">ملخص نتائج الجرد</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
                <p className="text-sm font-medium text-blue-500 dark:text-blue-300">إجمالي العناصر</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-100">{stats.totalItems}</p>
              </div>
              
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900 rounded-lg">
                <p className="text-sm font-medium text-yellow-500 dark:text-yellow-300">عناصر بها فروقات</p>
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-100">{stats.itemsWithDifference}</p>
              </div>
              
              <div className="p-4 bg-green-50 dark:bg-green-900 rounded-lg">
                <p className="text-sm font-medium text-green-500 dark:text-green-300">عناصر بزيادة</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-100">{stats.positiveItems}</p>
              </div>
              
              <div className="p-4 bg-red-50 dark:bg-red-900 rounded-lg">
                <p className="text-sm font-medium text-red-500 dark:text-red-300">عناصر بنقص</p>
                <p className="text-2xl font-bold text-red-700 dark:text-red-100">{stats.negativeItems}</p>
              </div>
              
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-300">عناصر بدون تغيير</p>
                <p className="text-2xl font-bold text-gray-700 dark:text-gray-100">{stats.noChangeItems}</p>
              </div>
              
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900 rounded-lg">
                <p className="text-sm font-medium text-indigo-500 dark:text-indigo-300">صافي الفرق</p>
                <p className={`text-2xl font-bold ${stats.totalDifference > 0 ? 'text-green-700 dark:text-green-100' : stats.totalDifference < 0 ? 'text-red-700 dark:text-red-100' : 'text-gray-700 dark:text-gray-100'}`}>
                  {stats.totalDifference > 0 && '+'}
                  {stats.totalDifference}
                </p>
              </div>
              
              <div className="p-4 bg-green-50 dark:bg-green-900 rounded-lg">
                <p className="text-sm font-medium text-green-500 dark:text-green-300">إجمالي الزيادة</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-100">+{stats.positiveDifference}</p>
              </div>
              
              <div className="p-4 bg-red-50 dark:bg-red-900 rounded-lg">
                <p className="text-sm font-medium text-red-500 dark:text-red-300">إجمالي النقص</p>
                <p className="text-2xl font-bold text-red-700 dark:text-red-100">-{stats.negativeDifference}</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">عناصر الجرد</h2>
            <div className="relative">
              <input
                type="text"
                placeholder="بحث عن منتج..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64 px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                dir="rtl"
              />
              <svg
                className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-300"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
          
          {auditItems.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              لا توجد عناصر في هذا الجرد
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      المنتج
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      SKU
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      الكمية المتوقعة
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      الكمية الفعلية
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      الفرق
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      ملاحظات
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
                  {filteredItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {item.product.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {item.product.sku}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {item.expected_quantity} {item.product.unit}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {item.actual_quantity !== null ? `${item.actual_quantity} ${item.product.unit}` : '-'}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                        item.difference === null ? 'text-gray-500 dark:text-gray-400' :
                        item.difference < 0 ? 'text-red-600 dark:text-red-400' :
                        item.difference > 0 ? 'text-green-600 dark:text-green-400' :
                        'text-gray-500 dark:text-gray-400'
                      }`}>
                        {item.difference !== null ? (
                          <>
                            {item.difference > 0 && '+'}
                            {item.difference} {item.product.unit}
                          </>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {item.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
