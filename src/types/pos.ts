export interface ServiceCategory {
  id: string;
  name: string;
  description: string;
}

export interface Service {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  duration: number;
  active: boolean;
  image?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  preferences: string;
  lastVisit: string;
  visitCount: number;
  active: boolean;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  phone: string;
  commissionRate: number;
  active: boolean;
  servicesPerformed: number;
  revenueGenerated: number;
  commissionEarned: number;
}

export interface CartItem {
  serviceId: string;
  serviceName: string;
  price: number;
  quantity: number;
  employeeId: string;
  employeeName: string;
  assignedEmployees?: Array<{ id: string; name: string }>;
}

export interface Transaction {
  id: string;
  customerId: string;
  customerName: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: "cash" | "card" | "online";
  date: string;
  invoiceNumber: string;
  paidAmount?: number;
  remainingBalance?: number;
  paymentStatus?: "paid" | "partial" | "unpaid";
  paymentBreakdown?: Record<string, number> | null;
  /**
   * When this transaction is an edited copy of an earlier bill,
   * this field stores the original invoice number for traceability.
   */
  originalInvoiceNumber?: string;
  /** True when this record represents a modified version of an original bill. */
  isEditedCopy?: boolean;
}

export interface Package {
  id: string;
  name: string;
  serviceIds: string[];
  discountedPrice: number;
  startDate: string;
  endDate: string;
  usageCount: number;
  revenue: number;
}

export interface Discount {
  id: string;
  name: string;
  type: "percentage" | "fixed";
  value: number;
  maxCap?: number;
  reason: string;
  usageCount: number;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  paymentMethod?: "cash" | "online" | "card" | string;
  notes: string;
  expenseDate: string;
  createdByName?: string;
  createdAt?: string;
}
