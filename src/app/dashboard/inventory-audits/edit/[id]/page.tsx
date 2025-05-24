import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { InventoryAudit, InventoryAuditItem, Product } from '@/types';
import RoleGuard from '@/components/auth/role-guard';
import { useAuthStore } from '@/lib/store/auth';
import { formatDate } from '@/lib/utils/format';

export default function EditInventoryAuditPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<InventoryAudit | null>(null);
  const [auditItems, setAuditItems] = useState<(InventoryAuditItem & { product: Product })[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredItems, setFilteredItems] = useState<(InventoryAuditItem & { product: Product })[]>([]);
  const [branchName, setBranchName] = useState('');
  const router = useRouter();
  const params = useParams();
  const auditId = params?.id as string;
  const { user } = useAuthStore();
  
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
        
        // Check if audit is editable
        if (auditData.status !== 'draft' && auditData.status !== 'in_progress') {
          throw new Error('لا يمكن تعديل الجرد بعد اكتماله أو إلغائه');
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
        
        // If no items exist yet, create them from current inventory
        if (itemsData.length === 0 && auditData.status === 'draft') {
          // Fetch current inventory for the branch
          const { data: inventoryData, error: inventoryError } = await supabase
            .from('inventory_items')
            .select(`
              *,
              product:product_id (*)
            `)
            .eq('branch_id', auditData.branch_id);
            
          if (inventoryError) {
            throw new Error(inventoryError.message);
          }
          
          // Create audit items from inventory
          if (inventoryData && inventoryData.length > 0) {
            const auditItemsToInsert = inventoryData.map(item => ({
              audit_id: auditId,
              product_id: item.product_id,
              expected_quantity: item.quantity,
              actual_quantity: null,
              difference: null,
              notes: null
            }));
            
            const { data: newItemsData, error: insertError } = await supabase
              .from('inventory_audit_items')
              .insert(auditItemsToInsert)
              .select(`
                *,
                product:product_id (*)
              `);
              
            if (insertError) {
              throw new Error(insertError.message);
            }
            
            // Update audit status to in_progress
            const { error: updateError } = await supabase
              .from('inventory_audits')
              .update({ 
                status: 'in_progress',
                item_count: newItemsData.length
              })
              .eq('id', auditId);
              
            if (updateError) {
              throw new Error(updateError.message);
            }
            
            auditData.status = 'in_progress';
            auditData.item_count = newItemsData.length;
            
            setAuditItems(newItemsData || []);
          } else {
            // No inventory items found
            setAuditItems([]);
          }
        } else {
          setAuditItems(itemsData || []);
        }
        
        setAudit(auditData);
        setBranchName(branchData.name);
        
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
  
  const handleActualQuantityChange = async (itemId: string, value: number) => {
    try {
      const supabase = createClient();
      
      // Find the item
      const item = auditItems.find(i => i.id === itemId);
      if (!item) return;
      
      // Calculate difference
      const difference = value - item.expected_quantity;
      
      // Update the item in the database
      const { error: updateError } = await supabase
        .from('inventory_audit_items')
        .update({ 
          actual_quantity: value,
          difference: difference
        })
        .eq('id', itemId);
        
      if (updateError) {
        throw new Error(updateError.message);
      }
      
      // Update local state
      setAuditItems(prevItems => 
        prevItems.map(i => 
          i.id === itemId 
            ? { ...i, actual_quantity: value, difference: difference } 
            : i
        )
      );
      
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تحديث الكمية الفعلية');
    }
  };
  
  const handleItemNoteChange = async (itemId: string, value: string) => {
    try {
      const supabase = createClient();
      
      // Update the item in the database
      const { error: updateError } = await supabase
        .from('inventory_audit_items')
        .update({ notes: value })
        .eq('id', itemId);
        
      if (updateError) {
        throw new Error(updateError.message);
      }
      
      // Update local state
      setAuditItems(prevItems => 
        prevItems.map(i => 
          i.id === itemId 
            ? { ...i, notes: value } 
            : i
        )
      );
      
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تحديث الملاحظات');
    }
  };
  
  const handleSaveAudit = async () => {
    setIsSaving(true);
    setError(null);
    
    try {
      const supabase = createClient();
      
      // Update audit status to in_progress if it's draft
      if (audit?.status === 'draft') {
        const { error: updateError } = await supabase
          .from('inventory_audits')
          .update({ 
            status: 'in_progress',
            updated_at: new Date().toISOString(),
            updated_by: user?.id
          })
          .eq('id', auditId);
          
        if (updateError) {
          throw new Error(updateError.message);
        }
        
        setAudit(prev => prev ? { ...prev, status: 'in_progress' } : null);
      }
      
      router.push('/dashboard/inventory-audits');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ الجرد');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleCompleteAudit = async () => {
    // التحقق من إدخال جميع الكميات الفعلية
    const incompleteItems = auditItems.filter(item => item.actual_quantity === null);
    if (incompleteItems.length > 0) {
      setError('يجب إدخال الكمية الفعلية لجميع المنتجات قبل إكمال الجرد');
      return;
    }
    
    if (!confirm('هل أنت متأكد من إكمال الجرد؟ سيتم تحديث المخزون بناءً على الكميات الفعلية.')) {
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const supabase = createClient();
      
      // Update audit status to completed
      const { error: updateError } = await supabase
        .from('inventory_audits')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user?.id,
          updated_at: new Date().toISOString(),
          updated_by: user?.id
        })
        .eq('id', auditId);
        
      if (updateError) {
        throw new Error(updateError.message);
      }
      
      // تحديث المخزون سيتم تلقائياً عبر Trigger في قاعدة البيانات
      
      router.push('/dashboard/inventory-audits');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إكمال الجرد');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleCancelAudit = async () => {
    if (!confirm('هل أنت متأكد من إلغاء الجرد؟ لن يتم تحديث المخزون.')) {
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const supabase = createClient();
      
      // Update audit status to cancelled
      const { error: updateError } = await supabase
        .from('inventory_audits')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString(),
          updated_by: user?.id
        })
        .eq('id', auditId);
        
      if (updateError) {
        throw new Error(updateError.message);
      }
      
      router.push('/dashboard/inventory-audits');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إلغاء الجرد');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error && !audit) {
    return (
      <div className="p-6">
        <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900 dark:text-red-100">
          {error}
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">تعديل جرد المخزون</h1>
          <div className="flex space-x-2 space-x-reverse">
            <button
              onClick={() => router.push('/dashboard/inventory-audits')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              العودة إلى القائمة
            </button>
          </div>
        </div>
        
        {error && (
          <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900 dark:text-red-100">
            {error}
          </div>
        )}
        
        <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">معلومات الجرد</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">رقم المرجع</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{audit?.reference_number}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">الفرع</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{branchName}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">تاريخ الجرد</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{formatDate(audit?.audit_date || '')}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">الحالة</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {audit?.status === 'draft' && 'مسودة'}
                {audit?.status === 'in_progress' && 'قيد التنفيذ'}
                {audit?.status === 'completed' && 'مكتمل'}
                {audit?.status === 'cancelled' && 'ملغي'}
              </p>
            </div>
          </div>
          
          {audit?.notes && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">ملاحظات</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{audit.notes}</p>
            </div>
          )}
        </div>
        
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.actual_quantity !== null ? item.actual_quantity : ''}
                          onChange={(e) => handleActualQuantityChange(item.id, parseFloat(e.target.value) || 0)}
                          className="w-24 px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          dir="rtl"
                          disabled={audit?.status !== 'draft' && audit?.status !== 'in_progress'}
                        />
                        <span className="mr-2 text-gray-500 dark:text-gray-400">
                          {item.product.unit}
                        </span>
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          value={item.notes || ''}
                          onChange={(e) => handleItemNoteChange(item.id, e.target.value)}
                          className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          dir="rtl"
                          placeholder="ملاحظات..."
                          disabled={audit?.status !== 'draft' && audit?.status !== 'in_progress'}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {(audit?.status === 'draft' || audit?.status === 'in_progress') && (
            <div className="mt-6 flex justify-end space-x-4 space-x-reverse">
              <button
                onClick={handleCancelAudit}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'جاري الإلغاء...' : 'إلغاء الجرد'}
              </button>
              <button
                onClick={handleSaveAudit}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'جاري الحفظ...' : 'حفظ والعودة لاحقاً'}
              </button>
              <button
                onClick={handleCompleteAudit}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'جاري الإكمال...' : 'إكمال الجرد وتحديث المخزون'}
              </button>
            </div>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
