import { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Product, Branch } from '@/types';
import RoleGuard from '@/components/auth/role-guard';
import { useAuthStore } from '@/lib/store/auth';
import { calculateVAT, calculateTotalWithVAT } from '@/lib/utils/calculations';
import { generateInvoiceNumber } from '@/lib/utils/format';

const purchaseItemSchema = z.object({
  product_id: z.string().min(1, 'المنتج مطلوب'),
  quantity: z.number().min(0.01, 'الكمية يجب أن تكون أكبر من صفر'),
  unit_price: z.number().min(0.01, 'السعر يجب أن يكون أكبر من صفر'),
  vat_percentage: z.number().min(0).max(100, 'نسبة الضريبة يجب أن تكون بين 0 و 100'),
  total_price: z.number().min(0),
});

const purchaseInvoiceSchema = z.object({
  invoice_number: z.string().min(1, 'رقم الفاتورة مطلوب'),
  supplier: z.string().min(1, 'اسم المورد مطلوب'),
  branch_id: z.string().min(1, 'الفرع مطلوب'),
  items: z.array(purchaseItemSchema).min(1, 'يجب إضافة عنصر واحد على الأقل'),
});

type PurchaseItemFormValues = z.infer<typeof purchaseItemSchema>;
type PurchaseInvoiceFormValues = z.infer<typeof purchaseInvoiceSchema>;

export default function AddPurchasePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalVAT, setTotalVAT] = useState(0);
  const router = useRouter();
  const { user } = useAuthStore();
  
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PurchaseInvoiceFormValues>({
    resolver: zodResolver(purchaseInvoiceSchema),
    defaultValues: {
      invoice_number: generateInvoiceNumber(),
      supplier: '',
      branch_id: '',
      items: [
        {
          product_id: '',
          quantity: 1,
          unit_price: 0,
          vat_percentage: 15,
          total_price: 0,
        },
      ],
    },
  });
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });
  
  const watchItems = watch('items');
  
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const supabase = createClient();
        
        // Fetch products
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('*')
          .order('name', { ascending: true });
          
        if (productsError) {
          throw new Error(productsError.message);
        }
        
        // Fetch branches
        const { data: branchesData, error: branchesError } = await supabase
          .from('branches')
          .select('*')
          .order('name', { ascending: true });
          
        if (branchesError) {
          throw new Error(branchesError.message);
        }
        
        setProducts(productsData || []);
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
  
  // حساب إجمالي الفاتورة وضريبة القيمة المضافة
  useEffect(() => {
    let subTotal = 0;
    let vatAmount = 0;
    
    watchItems.forEach(item => {
      if (item.quantity && item.unit_price) {
        const itemSubtotal = item.quantity * item.unit_price;
        const itemVAT = calculateVAT(itemSubtotal, item.vat_percentage / 100);
        
        subTotal += itemSubtotal;
        vatAmount += itemVAT;
      }
    });
    
    setTotalAmount(subTotal + vatAmount);
    setTotalVAT(vatAmount);
  }, [watchItems]);
  
  // حساب سعر العنصر الإجمالي عند تغيير الكمية أو السعر
  const calculateItemTotal = (index: number) => {
    const item = watchItems[index];
    if (item.quantity && item.unit_price) {
      const subtotal = item.quantity * item.unit_price;
      const total = calculateTotalWithVAT(subtotal, item.vat_percentage / 100);
      setValue(`items.${index}.total_price`, total);
    }
  };
  
  const handleAddItem = () => {
    append({
      product_id: '',
      quantity: 1,
      unit_price: 0,
      vat_percentage: 15,
      total_price: 0,
    });
  };
  
  const onSubmit = async (data: PurchaseInvoiceFormValues) => {
    setIsSaving(true);
    setError(null);
    
    try {
      const supabase = createClient();
      
      // إنشاء فاتورة الشراء
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('purchase_invoices')
        .insert({
          invoice_number: data.invoice_number,
          supplier: data.supplier,
          branch_id: data.branch_id,
          total_amount: totalAmount,
          vat_amount: totalVAT,
          created_by: user?.id,
        })
        .select()
        .single();
        
      if (invoiceError) {
        throw new Error(invoiceError.message);
      }
      
      // إنشاء عناصر الفاتورة
      const purchaseItems = data.items.map(item => ({
        purchase_invoice_id: invoiceData.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        vat_percentage: item.vat_percentage,
        total_price: item.total_price,
      }));
      
      const { error: itemsError } = await supabase
        .from('purchase_items')
        .insert(purchaseItems);
        
      if (itemsError) {
        throw new Error(itemsError.message);
      }
      
      // تحديث المخزون سيتم تلقائياً عبر Trigger في قاعدة البيانات
      
      router.push('/dashboard/purchases');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إنشاء فاتورة الشراء');
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">إضافة فاتورة شراء جديدة</h1>
        </div>
        
        {error && (
          <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900 dark:text-red-100">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">معلومات الفاتورة</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label htmlFor="invoice_number" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  رقم الفاتورة
                </label>
                <input
                  id="invoice_number"
                  type="text"
                  {...register('invoice_number')}
                  className="w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  dir="rtl"
                />
                {errors.invoice_number && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.invoice_number.message}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="supplier" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  المورد
                </label>
                <input
                  id="supplier"
                  type="text"
                  {...register('supplier')}
                  className="w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  dir="rtl"
                />
                {errors.supplier && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.supplier.message}</p>
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
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">عناصر الفاتورة</h2>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                إضافة عنصر
              </button>
            </div>
            
            {errors.items && (
              <p className="mt-1 mb-4 text-sm text-red-600 dark:text-red-400">{errors.items.message}</p>
            )}
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      المنتج
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      الكمية
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      سعر الوحدة
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      نسبة الضريبة %
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      الإجمالي
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      الإجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
                  {fields.map((field, index) => (
                    <tr key={field.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          {...register(`items.${index}.product_id`)}
                          onChange={(e) => {
                            register(`items.${index}.product_id`).onChange(e);
                            calculateItemTotal(index);
                          }}
                          className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          dir="rtl"
                        >
                          <option value="">اختر المنتج</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name} ({product.sku})
                            </option>
                          ))}
                        </select>
                        {errors.items?.[index]?.product_id && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                            {errors.items[index]?.product_id?.message}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          step="0.01"
                          {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                          onChange={(e) => {
                            register(`items.${index}.quantity`).onChange(e);
                            calculateItemTotal(index);
                          }}
                          className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          dir="rtl"
                        />
                        {errors.items?.[index]?.quantity && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                            {errors.items[index]?.quantity?.message}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          step="0.01"
                          {...register(`items.${index}.unit_price`, { valueAsNumber: true })}
                          onChange={(e) => {
                            register(`items.${index}.unit_price`).onChange(e);
                            calculateItemTotal(index);
                          }}
                          className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          dir="rtl"
                        />
                        {errors.items?.[index]?.unit_price && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                            {errors.items[index]?.unit_price?.message}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          step="0.01"
                          {...register(`items.${index}.vat_percentage`, { valueAsNumber: true })}
                          onChange={(e) => {
                            register(`items.${index}.vat_percentage`).onChange(e);
                            calculateItemTotal(index);
                          }}
                          className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          dir="rtl"
                        />
                        {errors.items?.[index]?.vat_percentage && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                            {errors.items[index]?.vat_percentage?.message}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Controller
                          control={control}
                          name={`items.${index}.total_price`}
                          render={({ field }) => (
                            <input
                              type="number"
                              step="0.01"
                              value={field.value}
                              readOnly
                              className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md bg-gray-100 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                              dir="rtl"
                            />
                          )}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          حذف
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-left text-sm font-medium text-gray-900 dark:text-white">
                      المجموع الفرعي:
                    </td>
                    <td className="px-6 py-4 text-left text-sm font-medium text-gray-900 dark:text-white">
                      {(totalAmount - totalVAT).toFixed(2)} ريال
                    </td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-left text-sm font-medium text-gray-900 dark:text-white">
                      ضريبة القيمة المضافة:
                    </td>
                    <td className="px-6 py-4 text-left text-sm font-medium text-gray-900 dark:text-white">
                      {totalVAT.toFixed(2)} ريال
                    </td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-left text-sm font-bold text-gray-900 dark:text-white">
                      الإجمالي:
                    </td>
                    <td className="px-6 py-4 text-left text-sm font-bold text-gray-900 dark:text-white">
                      {totalAmount.toFixed(2)} ريال
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          
          <div className="flex justify-end space-x-4 space-x-reverse">
            <button
              type="button"
              onClick={() => router.push('/dashboard/purchases')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'جاري الحفظ...' : 'حفظ الفاتورة'}
            </button>
          </div>
        </form>
      </div>
    </RoleGuard>
  );
}
