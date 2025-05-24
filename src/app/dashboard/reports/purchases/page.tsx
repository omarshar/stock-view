import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Branch, PurchaseInvoice } from '@/types';
import RoleGuard from '@/components/auth/role-guard';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function PurchasesReportPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reportType, setReportType] = useState<string>('summary');
  const [purchaseData, setPurchaseData] = useState<{
    totalAmount: number;
    totalVat: number;
    invoiceCount: number;
    supplierCount: number;
    productCount: number;
    bySupplier: { name: string; amount: number }[];
    byProduct: { name: string; amount: number }[];
    byDate: { date: string; amount: number }[];
    invoices: (PurchaseInvoice & { supplier_name: string })[];
  }>({
    totalAmount: 0,
    totalVat: 0,
    invoiceCount: 0,
    supplierCount: 0,
    productCount: 0,
    bySupplier: [],
    byProduct: [],
    byDate: [],
    invoices: [],
  });
  const router = useRouter();
  
  useEffect(() => {
    // Set default date range (current month)
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    setStartDate(firstDayOfMonth.toISOString().split('T')[0]);
    setEndDate(lastDayOfMonth.toISOString().split('T')[0]);
    
    // Fetch branches
    const fetchBranches = async () => {
      try {
        const supabase = createClient();
        
        const { data, error } = await supabase
          .from('branches')
          .select('*')
          .order('name', { ascending: true });
          
        if (error) {
          throw new Error(error.message);
        }
        
        setBranches(data || []);
      } catch (err: any) {
        setError(err.message || 'حدث خطأ أثناء جلب بيانات الفروع');
      }
    };
    
    fetchBranches();
  }, []);
  
  useEffect(() => {
    const fetchReportData = async () => {
      if (!startDate || !endDate) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const supabase = createClient();
        
        // Base query for purchase invoices
        let query = supabase
          .from('purchase_invoices')
          .select(`
            *,
            supplier:supplier_id (name),
            purchase_items:purchase_invoice_items (
              *,
              product:product_id (name)
            )
          `)
          .gte('invoice_date', startDate)
          .lte('invoice_date', endDate);
          
        if (selectedBranch !== 'all') {
          query = query.eq('branch_id', selectedBranch);
        }
        
        const { data: invoices, error: invoicesError } = await query;
        
        if (invoicesError) {
          throw new Error(invoicesError.message);
        }
        
        // Process data for report
        const totalAmount = invoices?.reduce((sum, invoice) => sum + invoice.total_amount, 0) || 0;
        const totalVat = invoices?.reduce((sum, invoice) => sum + invoice.vat_amount, 0) || 0;
        const invoiceCount = invoices?.length || 0;
        
        // Get unique suppliers
        const suppliers = new Set();
        invoices?.forEach(invoice => {
          if (invoice.supplier_id) {
            suppliers.add(invoice.supplier_id);
          }
        });
        
        // Get unique products
        const products = new Set();
        invoices?.forEach(invoice => {
          invoice.purchase_items?.forEach(item => {
            if (item.product_id) {
              products.add(item.product_id);
            }
          });
        });
        
        // Group by supplier
        const supplierMap = new Map();
        invoices?.forEach(invoice => {
          if (invoice.supplier && invoice.supplier.name) {
            const supplierName = invoice.supplier.name;
            const currentAmount = supplierMap.get(supplierName) || 0;
            supplierMap.set(supplierName, currentAmount + invoice.total_amount);
          }
        });
        
        const bySupplier = Array.from(supplierMap.entries())
          .map(([name, amount]) => ({ name, amount: amount as number }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10);
        
        // Group by product
        const productMap = new Map();
        invoices?.forEach(invoice => {
          invoice.purchase_items?.forEach(item => {
            if (item.product && item.product.name) {
              const productName = item.product.name;
              const currentAmount = productMap.get(productName) || 0;
              productMap.set(productName, currentAmount + item.total_price);
            }
          });
        });
        
        const byProduct = Array.from(productMap.entries())
          .map(([name, amount]) => ({ name, amount: amount as number }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10);
        
        // Group by date
        const dateMap = new Map();
        invoices?.forEach(invoice => {
          const date = invoice.invoice_date.split('T')[0];
          const currentAmount = dateMap.get(date) || 0;
          dateMap.set(date, currentAmount + invoice.total_amount);
        });
        
        const byDate = Array.from(dateMap.entries())
          .map(([date, amount]) => ({ date, amount: amount as number }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Format invoices for table display
        const formattedInvoices = invoices?.map(invoice => ({
          ...invoice,
          supplier_name: invoice.supplier?.name || 'غير معروف',
        })) || [];
        
        setPurchaseData({
          totalAmount,
          totalVat,
          invoiceCount,
          supplierCount: suppliers.size,
          productCount: products.size,
          bySupplier,
          byProduct,
          byDate,
          invoices: formattedInvoices,
        });
        
      } catch (err: any) {
        setError(err.message || 'حدث خطأ أثناء جلب بيانات التقرير');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchReportData();
  }, [selectedBranch, startDate, endDate]);
  
  const handleDateRangeChange = (range: string) => {
    const today = new Date();
    let start: Date;
    let end: Date = today;
    
    switch (range) {
      case 'week':
        start = new Date(today);
        start.setDate(today.getDate() - 7);
        break;
      case 'month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'quarter':
        const quarter = Math.floor(today.getMonth() / 3);
        start = new Date(today.getFullYear(), quarter * 3, 1);
        end = new Date(today.getFullYear(), (quarter + 1) * 3, 0);
        break;
      case 'year':
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
        break;
      default:
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }
    
    setDateRange(range);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };
  
  const handleExportCSV = () => {
    // Generate CSV content
    let csvContent = 'data:text/csv;charset=utf-8,';
    
    // Add headers
    csvContent += 'رقم الفاتورة,التاريخ,المورد,المبلغ الإجمالي,ضريبة القيمة المضافة\n';
    
    // Add rows
    purchaseData.invoices.forEach(invoice => {
      csvContent += `${invoice.invoice_number},${formatDate(invoice.invoice_date)},${invoice.supplier_name},${invoice.total_amount},${invoice.vat_amount}\n`;
    });
    
    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `تقرير_المشتريات_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    
    // Trigger download
    link.click();
    
    // Clean up
    document.body.removeChild(link);
  };
  
  const handlePrint = () => {
    window.print();
  };

  return (
    <RoleGuard allowedRoles={['admin', 'branch_manager']}>
      <div className="p-6 print:p-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 print:hidden">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">تقرير المشتريات</h1>
          
          <div className="flex flex-col md:flex-row gap-4">
            <div>
              <label htmlFor="branch" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                الفرع
              </label>
              <select
                id="branch"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                dir="rtl"
              >
                <option value="all">جميع الفروع</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="dateRange" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                الفترة الزمنية
              </label>
              <select
                id="dateRange"
                value={dateRange}
                onChange={(e) => handleDateRangeChange(e.target.value)}
                className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                dir="rtl"
              >
                <option value="week">آخر أسبوع</option>
                <option value="month">الشهر الحالي</option>
                <option value="quarter">الربع الحالي</option>
                <option value="year">السنة الحالية</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                من تاريخ
              </label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                dir="rtl"
              />
            </div>
            
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                إلى تاريخ
              </label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                dir="rtl"
              />
            </div>
            
            <div>
              <label htmlFor="reportType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                نوع التقرير
              </label>
              <select
                id="reportType"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                dir="rtl"
              >
                <option value="summary">ملخص</option>
                <option value="detailed">تفصيلي</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="print:hidden flex justify-end gap-2 mb-4">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            تصدير CSV
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            طباعة
          </button>
        </div>
        
        {error && (
          <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900 dark:text-red-100 print:hidden">
            {error}
          </div>
        )}
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64 print:hidden">
            <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <div className="print:block print:mb-8">
              <h1 className="text-2xl font-bold text-center mb-2 hidden print:block">تقرير المشتريات</h1>
              <p className="text-center text-gray-600 hidden print:block">
                {selectedBranch === 'all' 
                  ? 'جميع الفروع' 
                  : `الفرع: ${branches.find(b => b.id === selectedBranch)?.name || ''}`}
                {' | '}
                الفترة: {formatDate(startDate)} - {formatDate(endDate)}
              </p>
            </div>
            
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6 print:border print:border-gray-300">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">إجمالي المشتريات</h3>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(purchaseData.totalAmount)} ريال</p>
              </div>
              
              <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6 print:border print:border-gray-300">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">إجمالي ضريبة القيمة المضافة</h3>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(purchaseData.totalVat)} ريال</p>
              </div>
              
              <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6 print:border print:border-gray-300">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">عدد الفواتير</h3>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{purchaseData.invoiceCount}</p>
              </div>
              
              <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6 print:border print:border-gray-300">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">عدد الموردين</h3>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{purchaseData.supplierCount}</p>
              </div>
              
              <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6 print:border print:border-gray-300">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">عدد المنتجات</h3>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{purchaseData.productCount}</p>
              </div>
            </div>
            
            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 print:hidden">
              <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">المشتريات حسب المورد (أعلى 10)</h3>
                {purchaseData.bySupplier.length > 0 ? (
                  <div className="h-80">
                    <Bar
                      data={{
                        labels: purchaseData.bySupplier.map(item => item.name),
                        datasets: [
                          {
                            label: 'قيمة المشتريات',
                            data: purchaseData.bySupplier.map(item => item.amount),
                            backgroundColor: 'rgba(54, 162, 235, 0.6)',
                            borderColor: 'rgba(54, 162, 235, 1)',
                            borderWidth: 1,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        indexAxis: 'y',
                        plugins: {
                          legend: {
                            display: false,
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                const value = context.raw as number;
                                return `${formatCurrency(value)} ريال`;
                              }
                            }
                          }
                        },
                        scales: {
                          x: {
                            ticks: {
                              callback: function(value) {
                                return formatCurrency(value as number) + ' ريال';
                              }
                            }
                          },
                          y: {
                            ticks: {
                              font: {
                                family: 'Cairo, sans-serif',
                              },
                            }
                          }
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex justify-center items-center h-80 text-gray-500 dark:text-gray-400">
                    لا توجد بيانات متاحة
                  </div>
                )}
              </div>
              
              <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">المشتريات حسب المنتج (أعلى 10)</h3>
                {purchaseData.byProduct.length > 0 ? (
                  <div className="h-80">
                    <Bar
                      data={{
                        labels: purchaseData.byProduct.map(item => item.name),
                        datasets: [
                          {
                            label: 'قيمة المشتريات',
                            data: purchaseData.byProduct.map(item => item.amount),
                            backgroundColor: 'rgba(75, 192, 192, 0.6)',
                            borderColor: 'rgba(75, 192, 192, 1)',
                            borderWidth: 1,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        indexAxis: 'y',
                        plugins: {
                          legend: {
                            display: false,
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                const value = context.raw as number;
                                return `${formatCurrency(value)} ريال`;
                              }
                            }
                          }
                        },
                        scales: {
                          x: {
                            ticks: {
                              callback: function(value) {
                                return formatCurrency(value as number) + ' ريال';
                              }
                            }
                          },
                          y: {
                            ticks: {
                              font: {
                                family: 'Cairo, sans-serif',
                              },
                            }
                          }
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex justify-center items-center h-80 text-gray-500 dark:text-gray-400">
                    لا توجد بيانات متاحة
                  </div>
                )}
              </div>
              
              <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6 lg:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">اتجاه المشتريات</h3>
                {purchaseData.byDate.length > 0 ? (
                  <div className="h-80">
                    <Bar
                      data={{
                        labels: purchaseData.byDate.map(item => formatDate(item.date)),
                        datasets: [
                          {
                            label: 'قيمة المشتريات',
                            data: purchaseData.byDate.map(item => item.amount),
                            backgroundColor: 'rgba(153, 102, 255, 0.6)',
                            borderColor: 'rgba(153, 102, 255, 1)',
                            borderWidth: 1,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            display: false,
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                const value = context.raw as number;
                                return `${formatCurrency(value)} ريال`;
                              }
                            }
                          }
                        },
                        scales: {
                          y: {
                            ticks: {
                              callback: function(value) {
                                return formatCurrency(value as number) + ' ريال';
                              }
                            }
                          },
                          x: {
                            ticks: {
                              font: {
                                family: 'Cairo, sans-serif',
                              },
                              maxRotation: 45,
                              minRotation: 45,
                            }
                          }
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex justify-center items-center h-80 text-gray-500 dark:text-gray-400">
                    لا توجد بيانات متاحة
                  </div>
                )}
              </div>
            </div>
            
            {/* Detailed Report */}
            {reportType === 'detailed' && (
              <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6 print:p-0 print:shadow-none">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 print:text-black">تفاصيل الفواتير</h3>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 print:border print:border-gray-300">
                    <thead className="bg-gray-50 dark:bg-gray-800 print:bg-gray-100">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 print:text-black">
                          رقم الفاتورة
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 print:text-black">
                          التاريخ
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 print:text-black">
                          المورد
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 print:text-black">
                          المبلغ قبل الضريبة
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 print:text-black">
                          ضريبة القيمة المضافة
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 print:text-black">
                          المبلغ الإجمالي
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 print:hidden">
                          الإجراءات
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700 print:bg-white">
                      {purchaseData.invoices.map((invoice) => (
                        <tr key={invoice.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white print:text-black">
                            {invoice.invoice_number}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 print:text-black">
                            {formatDate(invoice.invoice_date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 print:text-black">
                            {invoice.supplier_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 print:text-black">
                            {formatCurrency(invoice.total_amount - invoice.vat_amount)} ريال
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 print:text-black">
                            {formatCurrency(invoice.vat_amount)} ريال
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 print:text-black">
                            {formatCurrency(invoice.total_amount)} ريال
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium print:hidden">
                            <button
                              onClick={() => router.push(`/dashboard/purchases/view/${invoice.id}`)}
                              className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                            >
                              عرض
                            </button>
                          </td>
                        </tr>
                      ))}
                      
                      {purchaseData.invoices.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400 print:text-black">
                            لا توجد فواتير في هذه الفترة
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-gray-50 dark:bg-gray-800 print:bg-gray-100">
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white print:text-black">
                          الإجمالي
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white print:text-black">
                          {formatCurrency(purchaseData.totalAmount - purchaseData.totalVat)} ريال
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white print:text-black">
                          {formatCurrency(purchaseData.totalVat)} ريال
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white print:text-black">
                          {formatCurrency(purchaseData.totalAmount)} ريال
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium print:hidden"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </RoleGuard>
  );
}
