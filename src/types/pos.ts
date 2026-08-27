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
  /** Membership redemption metadata (POS) */
  membershipId?: string;
  membershipRedeemed?: boolean;
  membershipStatus?: "redeemed" | "paid" | string;
  membershipUsedByType?: "holder" | "friend";
  membershipFriendId?: string;
  membershipFriendName?: string;
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

/** Membership category service line (quantity: null=not included, 0=unlimited, n=limited) */
export interface MembershipCategoryService {
  id?: string;
  serviceId?: string;
  serviceName: string;
  servicePrice: number;
  quantity: number | null;
  shareable?: boolean;
}

export interface MembershipCategory {
  id: string;
  name: string;
  durationMonths: number;
  discountPercent: number;
  price: number;
  priceBeforeDiscount: number;
  shareable: boolean;
  active: boolean;
  terms?: string;
  services: MembershipCategoryService[];
}

export interface MembershipServiceUsage {
  id: string;
  serviceId?: string;
  serviceName: string;
  servicePrice: number;
  /** null = not included, 0 = unlimited, n = limited */
  allowedQty: number | null;
  usedQty: number;
  shareable?: boolean;
}

export interface MembershipFriend {
  id: string;
  membershipId: string;
  name: string;
  phone: string;
  relationship?: string;
}

export interface MembershipServicesSummary {
  included: number;
  unlimited: number;
  limitedRemaining: number;
  usedTotal?: number;
  totalServices: number;
}

export interface MembershipUsageRecord {
  id: string;
  serviceName: string;
  usedByType: "holder" | "friend" | string;
  friendName?: string;
  friendPhone?: string;
  quantity: number;
  status: "redeemed" | "paid" | string;
  amountCharged: number;
  usageDate: string;
}

export interface Membership {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  categoryId: string;
  categoryName: string;
  durationMonths: number;
  discountPercent: number;
  price: number;
  startDate: string;
  endDate: string;
  status: "active" | "expired" | "upcoming" | "cancelled" | string;
  invoiceNumber: string;
  paymentStatus: "paid" | "partial" | "unpaid" | string;
  paidAmount: number;
  notes?: string;
  referenceBy?: string;
  terms?: string;
  friendsCount?: number;
  friendsSummary?: string[];
  services?: MembershipServiceUsage[];
  friends?: MembershipFriend[];
  usage?: MembershipUsageRecord[];
  servicesSummary?: MembershipServicesSummary;
}
