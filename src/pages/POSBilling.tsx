import { useEffect, useState } from "react";
import { Service, ServiceCategory, Customer, Employee, Package, Discount, CartItem, Transaction } from "@/types/pos";
import { cn } from "@/lib/utils";
import {
  X,
  Minus,
  Plus,
  Search,
  CreditCard,
  Banknote,
  Globe,
  FileText,
  Printer,
  Download,
  ChevronDown,
  Check,
  ShoppingCart,
  LayoutGrid,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { CustomerSearch } from "@/components/CustomerSearch";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { getApiOrigin } from "@/lib/apiBase";
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from "@/lib/appSettings";
import { DEFAULT_DISCOUNTS, DISCOUNTS_STORAGE_KEY } from "@/lib/discounts";
import { openPrintWindow, buildProfessionalInvoiceHtml } from "@/lib/exporting";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE = getApiOrigin();
const TRANSACTIONS_API_BASE = `${API_BASE}/transactions.php`;
const SERVICES_API_BASE = `${API_BASE}/services.php`;
const CUSTOMERS_API_BASE = `${API_BASE}/customers.php`;
const EMPLOYEES_API_BASE = `${API_BASE}/employees.php`;
const PACKAGES_API_BASE = `${API_BASE}/packages.php`;
const DISCOUNTS_API_BASE = `${API_BASE}/discounts.php`;
const MEMBERSHIPS_API_BASE = `${API_BASE}/memberships.php`;
const SERVICE_IMAGE_BASE = API_BASE;

const POSBilling = () => {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [serviceCategoriesState, setServiceCategoriesState] = useState<ServiceCategory[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>(DEFAULT_DISCOUNTS);

  const [selectedCategoryIds, setSelectedCategoryIds] = useLocalStorageState<string[]>(
    "salon-spark:pos-selected-categories",
    []
  );
  const [activeCategoryFilterId, setActiveCategoryFilterId] = useState<string>("all");
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedDiscountId, setSelectedDiscountId] = useState<string>("none");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [checkoutComplete, setCheckoutComplete] = useState(false);
  const [settings] = useLocalStorageState(SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS);
  const [, setStoredDiscounts] = useLocalStorageState(DISCOUNTS_STORAGE_KEY, DEFAULT_DISCOUNTS);
  const [invoiceNumber, setInvoiceNumber] = useState(
    () => `${settings.invoicePrefix}${String(Math.floor(Math.random() * 9000) + 1000)}`
  );
  const [transactions, setTransactions] = useLocalStorageState<Transaction[]>(
    "salon-spark:transactions",
    []
  );
  const [originalTransaction, setOriginalTransaction] = useState<Transaction | null>(null);
  const [manualDiscount, setManualDiscount] = useState<string>("");
  const [paidInput, setPaidInput] = useState<string>("");
  const [billingMode, setBillingMode] = useState<"new_invoice" | "existing_due" | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [customerBalanceSummary, setCustomerBalanceSummary] = useState<{
    total_amount: number;
    paid_amount: number;
    remaining_balance: number;
  } | null>(null);
  const [activeMembership, setActiveMembership] = useState<{
    id: string;
    categoryName: string;
    endDate: string;
    friends: Array<{ id: string; name: string; phone: string }>;
  } | null>(null);
  /** holder = membership customer; otherwise friend id */
  const [membershipUserKey, setMembershipUserKey] = useState<string>("holder");
  /** Mobile: switch between catalog and cart full screens */
  const [mobilePanel, setMobilePanel] = useState<"services" | "cart">("services");

  useEffect(() => {
    if (checkoutComplete) setMobilePanel("cart");
  }, [checkoutComplete]);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [svcRes, custRes, empRes, pkgRes, discRes] = await Promise.all([
          fetch(SERVICES_API_BASE),
          fetch(CUSTOMERS_API_BASE),
          fetch(EMPLOYEES_API_BASE),
          fetch(PACKAGES_API_BASE),
          fetch(DISCOUNTS_API_BASE),
        ]);

        // Services + categories
        if (svcRes.ok) {
          const raw = await svcRes.json();
          const catMap = new Map<string, string>();
          const mappedServices: Service[] = (raw as any[]).map((row) => {
            const catId = `cat-${row.category_id}`;
            if (row.category_name) {
              catMap.set(catId, String(row.category_name));
            }
            const imageUrl = row.image_url
              ? String(row.image_url).startsWith("http")
                ? String(row.image_url)
                : `${SERVICE_IMAGE_BASE}/${String(row.image_url).replace(/^\/+/, "")}`
              : undefined;
            return {
              id: String(row.id),
              name: String(row.name),
              categoryId: catId,
              price: Number(row.price),
              duration: Number(row.duration),
              active: Boolean(row.active),
              image: imageUrl,
            };
          });
          setServices(mappedServices);
          const mappedCats: ServiceCategory[] = Array.from(catMap.entries()).map(([id, name]) => ({
            id,
            name,
            description: "",
          }));
          setServiceCategoriesState(mappedCats);
        }

        // Customers
        if (custRes.ok) {
          const raw = await custRes.json();
          const mappedCustomers: Customer[] = (raw as any[]).map((row) => ({
            id: String(row.id),
            name: String(row.name),
            phone: String(row.phone),
            email: String(row.email ?? ""),
            notes: String(row.notes ?? ""),
            preferences: String(row.preferences ?? ""),
            lastVisit: String(row.last_visit ?? ""),
            visitCount: Number(row.visit_count ?? 0),
            active: Boolean(row.active ?? 1),
          }));
          setCustomers(mappedCustomers);
        }

        // Employees
        if (empRes.ok) {
          const raw = await empRes.json();
          const mappedEmployees: Employee[] = (raw as any[]).map((row) => ({
            id: String(row.id),
            name: String(row.name),
            role: String(row.role),
            phone: String(row.phone),
            commissionRate: Number(row.commission_rate ?? row.commissionRate ?? 0),
            active: Boolean(row.active),
            servicesPerformed: Number(row.services_performed ?? row.servicesPerformed ?? 0),
            revenueGenerated: Number(row.revenue_generated ?? row.revenueGenerated ?? 0),
            commissionEarned: Number(row.commission_earned ?? row.commissionEarned ?? 0),
          }));
          setEmployees(mappedEmployees);
        }

        // Packages
        if (pkgRes.ok) {
          const raw = await pkgRes.json();
          const mappedPackages: Package[] = (raw as any[]).map((row) => ({
            id: String(row.id),
            name: String(row.name),
            serviceIds: [], // not needed in POS billing
            discountedPrice: Number(row.discounted_price ?? row.discountedPrice ?? 0),
            startDate: String(row.start_date ?? row.startDate ?? ""),
            endDate: String(row.end_date ?? row.endDate ?? ""),
            usageCount: Number(row.usage_count ?? row.usageCount ?? 0),
            revenue: Number(row.revenue ?? 0),
          }));
          setPackages(mappedPackages);
        }

        // Discounts
        if (discRes.ok) {
          const raw = await discRes.json();
          const mappedDiscounts: Discount[] = (raw as any[]).map((row) => ({
            id: String(row.id),
            name: String(row.name),
            type: row.type === "fixed" ? "fixed" : "percentage",
            value: Number(row.value ?? 0),
            maxCap: row.max_cap !== null && row.max_cap !== undefined ? Number(row.max_cap) : undefined,
            reason: String(row.reason ?? ""),
            usageCount: Number(row.usage_count ?? 0),
          }));
          setDiscounts(mappedDiscounts);
          setStoredDiscounts(mappedDiscounts);
        }
      } catch {
        // ignore load errors; UI will just have empty lists or defaults
      }
    };

    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allCategoryIds = serviceCategoriesState.map((cat) => cat.id);

  useEffect(() => {
    if (!allCategoryIds.length) return;
    setSelectedCategoryIds((prev) => {
      const clean = (prev ?? []).filter((id) => allCategoryIds.includes(id));
      const missing = allCategoryIds.filter((id) => !clean.includes(id));
      if (clean.length === 0) return allCategoryIds;
      if (missing.length === 0 && clean.length === prev.length) return prev;
      return [...clean, ...missing];
    });
  }, [allCategoryIds.join("|"), setSelectedCategoryIds]);

  const selectedCategorySet = new Set(selectedCategoryIds);

  useEffect(() => {
    if (selectedCategoryIds.length === 0) {
      setActiveCategoryFilterId("all");
      return;
    }
    if (activeCategoryFilterId !== "all" && !selectedCategoryIds.includes(activeCategoryFilterId)) {
      setActiveCategoryFilterId("all");
    }
  }, [selectedCategoryIds, activeCategoryFilterId]);

  useEffect(() => {
    if (!selectedCustomer) {
      setCustomerBalanceSummary(null);
      setActiveMembership(null);
      setMembershipUserKey("holder");
      // Walk-in does not have due-balance lookup, so keep invoice mode active.
      setBillingMode("new_invoice");
      return;
    }
    setBillingMode(null);
    setMembershipUserKey("holder");
    const loadBalance = async () => {
      try {
        const res = await fetch(`${API_BASE}/customer_balances.php?customerId=${encodeURIComponent(selectedCustomer)}`);
        if (!res.ok) return;
        const data = await res.json();
        const remaining = Number(data?.summary?.remaining_balance ?? 0);
        setCustomerBalanceSummary({
          total_amount: Number(data?.summary?.total_amount ?? 0),
          paid_amount: Number(data?.summary?.paid_amount ?? 0),
          remaining_balance: remaining,
        });
        if (remaining <= 0) {
          setBillingMode("new_invoice");
        }
      } catch {
        setCustomerBalanceSummary(null);
      }
    };
    const loadMembership = async () => {
      try {
        const res = await fetch(
          `${MEMBERSHIPS_API_BASE}?resource=lookup&customerId=${encodeURIComponent(selectedCustomer)}`
        );
        if (!res.ok) {
          setActiveMembership(null);
          return;
        }
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.memberships ?? (data?.id ? [data] : []);
        const first = list[0];
        if (first) {
          const friendsRaw = Array.isArray(first.friends) ? first.friends : [];
          setActiveMembership({
            id: String(first.id),
            categoryName: String(first.category_name ?? first.categoryName ?? "Membership"),
            endDate: String(first.end_date ?? first.endDate ?? ""),
            friends: friendsRaw.map((f: Record<string, unknown>) => ({
              id: String(f.id),
              name: String(f.name ?? ""),
              phone: String(f.phone ?? ""),
            })),
          });
        } else {
          setActiveMembership(null);
        }
      } catch {
        setActiveMembership(null);
      }
    };
    void loadBalance();
    void loadMembership();
  }, [selectedCustomer]);

  const filteredServices = services.filter((s) => {
    const matchesCategory = selectedCategorySet.has(s.categoryId);
    const matchesActiveCategory = activeCategoryFilterId === "all" || s.categoryId === activeCategoryFilterId;
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesActiveCategory && matchesSearch && s.active;
  });

  const addToCart = async (serviceId: string) => {
    if (billingMode === "existing_due") return;
    const service = services.find((s) => s.id === serviceId);
    if (!service || !employees[0]) return;

    let price = service.price;
    let membershipId: string | undefined;
    let membershipRedeemed = false;
    let membershipStatus: string | undefined;
    let membershipUsedByType: "holder" | "friend" | undefined;
    let membershipFriendId: string | undefined;
    let membershipFriendName: string | undefined;

    if (selectedCustomer && activeMembership) {
      const isFriend = membershipUserKey !== "holder";
      const friend = isFriend
        ? activeMembership.friends.find((f) => f.id === membershipUserKey)
        : null;
      try {
        const res = await fetch(`${MEMBERSHIPS_API_BASE}?resource=redeem`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            membershipId: Number(activeMembership.id),
            serviceId: Number(service.id),
            serviceName: service.name,
            usedByType: isFriend ? "friend" : "holder",
            friendId: friend ? Number(friend.id) : undefined,
            quantity: 1,
            recordUsage: false,
          }),
        });
        if (res.ok) {
          const preview = await res.json();
          membershipId = activeMembership.id;
          membershipUsedByType = isFriend ? "friend" : "holder";
          membershipFriendId = friend?.id;
          membershipFriendName = friend?.name;
          if (preview?.status === "redeemed" || preview?.redeemable === true) {
            price = 0;
            membershipRedeemed = true;
            membershipStatus = "redeemed";
          } else {
            price = Number(preview?.amountCharged ?? service.price);
            membershipRedeemed = false;
            membershipStatus = "paid";
          }
        }
      } catch {
        /* keep normal price */
      }
    }

    const existing = cart.find(
      (c) =>
        c.serviceId === serviceId &&
        Boolean(c.membershipRedeemed) === membershipRedeemed &&
        (c.membershipFriendId || "") === (membershipFriendId || "")
    );
    if (existing) {
      setCart(cart.map((c) => (c === existing ? { ...c, quantity: c.quantity + 1 } : c)));
    } else {
      setCart([
        ...cart,
        {
          serviceId: service.id,
          serviceName: service.name,
          price,
          quantity: 1,
          employeeId: employees[0].id,
          employeeName: employees[0].name,
          assignedEmployees: [{ id: employees[0].id, name: employees[0].name }],
          membershipId,
          membershipRedeemed,
          membershipStatus,
          membershipUsedByType,
          membershipFriendId,
          membershipFriendName,
        },
      ]);
    }
  };

  const addPackageToCart = (packageId: string) => {
    if (billingMode === "existing_due") return;
    const pkg = packages.find((p) => p.id === packageId);
    if (!pkg) return;

    const existing = cart.find((c) => c.serviceId === packageId);
    if (existing) {
      setCart(cart.map((c) => (c.serviceId === packageId ? { ...c, quantity: c.quantity + 1 } : c)));
    } else {
      setCart([
        ...cart,
        {
          serviceId: pkg.id,
          serviceName: pkg.name,
          price: pkg.discountedPrice,
          quantity: 1,
          employeeId: employees[0].id,
          employeeName: employees[0].name,
          assignedEmployees: [{ id: employees[0].id, name: employees[0].name }],
        },
      ]);
    }
  };

  const removeFromCart = (serviceId: string) => {
    setCart(cart.filter((c) => c.serviceId !== serviceId));
  };

  const updateQuantity = (serviceId: string, delta: number) => {
    setCart(
      cart.map((c) => {
        if (c.serviceId === serviceId) {
          const newQ = c.quantity + delta;
          return newQ > 0 ? { ...c, quantity: newQ } : c;
        }
        return c;
      })
    );
  };

  const toggleAssignedEmployee = (serviceId: string, employeeId: string) => {
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return;
    setCart((prev) =>
      prev.map((c) => {
        if (c.serviceId !== serviceId) return c;
        const assigned = [...(c.assignedEmployees ?? (c.employeeId ? [{ id: c.employeeId, name: c.employeeName }] : []))];
        const exists = assigned.some((a) => a.id === employeeId);
        const next = exists ? assigned.filter((a) => a.id !== employeeId) : [...assigned, { id: emp.id, name: emp.name }];
        const limited = next.slice(0, 4);
        const primary = limited[0] ?? { id: "", name: "" };
        return { ...c, assignedEmployees: limited, employeeId: primary.id, employeeName: primary.name };
      })
    );
  };

  const subtotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);

  const selectedDiscount =
    selectedDiscountId === "none" || selectedDiscountId === "manual"
      ? null
      : discounts.find((d) => d.id === selectedDiscountId) ?? null;

  const automaticDiscountAmount = (() => {
    if (!selectedDiscount) return 0;
    if (subtotal <= 0) return 0;
    const raw =
      selectedDiscount.type === "percentage"
        ? (subtotal * selectedDiscount.value) / 100
        : selectedDiscount.value;
    const capped = typeof selectedDiscount.maxCap === "number" ? Math.min(raw, selectedDiscount.maxCap) : raw;
    return Math.max(0, Math.min(subtotal, capped));
  })();

  const manualDiscountAmount =
    selectedDiscountId === "manual" && subtotal > 0
      ? Math.max(0, Math.min(subtotal, Number(manualDiscount) || 0))
      : 0;

  const discountAmount = automaticDiscountAmount + manualDiscountAmount;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const tax = taxableAmount * (Number.isFinite(settings.taxRate) ? settings.taxRate : 0);
  const grandTotal = taxableAmount + tax;
  const paidInputNumber = paidInput.trim() === "" ? grandTotal : Number(paidInput);
  const paidAmount = Math.max(0, Math.min(grandTotal, Number.isFinite(paidInputNumber) ? paidInputNumber : grandTotal));
  const remainingBalance = Math.max(0, grandTotal - paidAmount);
  const hasOutstandingDue = (customerBalanceSummary?.remaining_balance ?? 0) > 0;
  const outstandingDueAmount = Math.max(0, Number(customerBalanceSummary?.remaining_balance ?? 0));
  const duePaidInputNumber = paidInput.trim() === "" ? 0 : Number(paidInput);
  const duePaymentAmount = Math.max(
    0,
    Math.min(outstandingDueAmount, Number.isFinite(duePaidInputNumber) ? duePaidInputNumber : 0)
  );
  const dueRemainingAfterPayment = Math.max(0, outstandingDueAmount - duePaymentAmount);
  const canCheckout =
    billingMode === "existing_due"
      ? Boolean(selectedCustomer) && duePaymentAmount > 0
      : billingMode === "new_invoice"
        ? cart.length > 0
        : false;

  const handleCheckout = (method: "cash" | "card" | "online") => {
    setCheckoutError(null);
    if (billingMode === "existing_due") {
      if (!selectedCustomer) {
        setCheckoutError("Select a customer first.");
        return;
      }
      if (duePaymentAmount <= 0) {
        setCheckoutError("Enter payment amount to clear due.");
        return;
      }
      const submitDuePayment = async () => {
        try {
          const res = await fetch(TRANSACTIONS_API_BASE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: "due_payment",
              customerId: selectedCustomer,
              paymentMethod: method,
              paidAmount: duePaymentAmount,
              date: new Date().toISOString().slice(0, 10),
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            setCheckoutError(String(err?.error ?? "Failed to apply payment to due invoices."));
            return;
          }
          const updated = await res.json().catch(() => null);
          const customer = customers.find((c) => c.id === selectedCustomer);
          const remainingAfter = Number(updated?.summary?.remaining_balance ?? dueRemainingAfterPayment);
          const dueTx: Transaction = {
            id: `due-${Date.now()}`,
            customerId: selectedCustomer,
            customerName: customer?.name ?? "Customer",
            items: [
              {
                serviceId: "due-payment",
                serviceName: "Due Payment Adjustment",
                price: duePaymentAmount,
                quantity: 1,
                employeeId: "",
                employeeName: "-",
              },
            ],
            subtotal: duePaymentAmount,
            discount: 0,
            tax: 0,
            total: duePaymentAmount,
            paymentMethod: method,
            date: new Date().toISOString().slice(0, 10),
            invoiceNumber: `DUE-${String(Date.now()).slice(-6)}`,
            paidAmount: duePaymentAmount,
            remainingBalance: Math.max(0, remainingAfter),
            paymentStatus: remainingAfter > 0 ? "partial" : "paid",
            paymentBreakdown: { [method]: duePaymentAmount },
          };
          if (updated?.summary) {
            setCustomerBalanceSummary({
              total_amount: Number(updated.summary.total_amount ?? 0),
              paid_amount: Number(updated.summary.paid_amount ?? 0),
              remaining_balance: Number(updated.summary.remaining_balance ?? 0),
            });
          }
          setTransactions((prev) => [...prev, dueTx]);
          setOriginalTransaction(dueTx);
          setCheckoutComplete(true);
        } catch {
          setCheckoutError("Failed to apply due payment.");
        }
      };
      void submitDuePayment();
      return;
    }
    if (!cart.length) return;
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const customer = customers.find((c) => c.id === selectedCustomer);

    const tx: Transaction = {
      id: `t-${now.getTime()}`,
      customerId: customer?.id ?? "walk-in",
      customerName: customer?.name ?? "Walk-in Customer",
      items: cart,
      subtotal,
      discount: discountAmount,
      tax,
      total: grandTotal,
      paymentMethod: method,
      date: dateStr,
      invoiceNumber,
      paidAmount,
      remainingBalance,
      paymentStatus: remainingBalance > 0 ? "partial" : "paid",
      paymentBreakdown: { [method]: paidAmount },
    };

    const submit = async () => {
      try {
        const res = await fetch(TRANSACTIONS_API_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tx),
        });
        const saved = res.ok ? await res.json().catch(() => null) : null;
        const transactionId = saved?.id ? Number(saved.id) : null;

        // Record membership redemptions after invoice is saved
        for (const item of cart) {
          if (!item.membershipId || !item.membershipStatus) continue;
          for (let q = 0; q < item.quantity; q++) {
            try {
              await fetch(`${MEMBERSHIPS_API_BASE}?resource=redeem`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  membershipId: Number(item.membershipId),
                  serviceId: Number(String(item.serviceId).replace(/^s/, "")),
                  serviceName: item.serviceName,
                  usedByType: item.membershipUsedByType || "holder",
                  friendId: item.membershipFriendId ? Number(item.membershipFriendId) : undefined,
                  quantity: 1,
                  recordUsage: true,
                  transactionId,
                  usageDate: dateStr,
                }),
              });
            } catch {
              /* non-blocking */
            }
          }
        }
      } catch (e) {
        // ignore for now, local state still keeps a copy
        console.error(e);
      }
    };

    void submit();

    setTransactions((prev) => [...prev, tx]);
    setOriginalTransaction(tx);
    setCheckoutComplete(true);
  };

  const handleNewTransaction = () => {
    setCart([]);
    setSelectedDiscountId("none");
    setSelectedCustomer(null);
    setCheckoutComplete(false);
    setSearchQuery("");
    setOriginalTransaction(null);
    setCheckoutError(null);
    setPaidInput("");
    setActiveMembership(null);
    setMembershipUserKey("holder");
    setInvoiceNumber(`${settings.invoicePrefix}${String(Math.floor(Math.random() * 9000) + 1000)}`);
  };

  useEffect(() => {
    if (!checkoutError) return;
    setCheckoutError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paidInput, billingMode, selectedCustomer]);

  const customer = customers.find((c) => c.id === selectedCustomer);
  const completedAmount = Number(originalTransaction?.paidAmount ?? originalTransaction?.total ?? grandTotal);
  const completedInvoiceNumber = originalTransaction?.invoiceNumber ?? invoiceNumber;

  const buildInvoiceHtmlFromCart = () =>
    buildProfessionalInvoiceHtml({
      invoiceNumber,
      date: new Date().toISOString().slice(0, 10),
      customerName: customer?.name ?? "Walk-in Customer",
      paymentMethod: undefined,
      cashierName: user?.name ?? undefined,
      items: cart.map((it) => ({
        serviceName: it.serviceName,
        employeeName: it.employeeName,
        quantity: it.quantity,
        price: it.price,
        total: it.price * it.quantity,
      })),
      subtotal,
      discount: discountAmount,
      tax,
      total: grandTotal,
      paidAmount,
      balanceAmount: remainingBalance,
    });

  const buildInvoiceHtmlFromTx = (tx: Transaction) => {
    const items = tx.items ?? [];
    return buildProfessionalInvoiceHtml({
      invoiceNumber: tx.invoiceNumber,
      date: tx.date,
      customerName: tx.customerName,
      paymentMethod: tx.paymentMethod,
      cashierName: user?.name ?? undefined,
      items: items.map((it) => ({
        serviceName: it.serviceName,
        employeeName: it.employeeName,
        quantity: it.quantity,
        price: it.price,
        total: it.price * it.quantity,
      })),
      subtotal: Number(tx.subtotal ?? 0),
      discount: Number(tx.discount ?? 0),
      tax: Number(tx.tax ?? 0),
      total: Number(tx.total ?? 0),
      paidAmount: Number(tx.paidAmount ?? tx.total ?? 0),
      balanceAmount: Number(tx.remainingBalance ?? 0),
    });
  };

  const printInvoice = () => {
    const tx = originalTransaction;
    const html = tx ? buildInvoiceHtmlFromTx(tx) : buildInvoiceHtmlFromCart();
    const title = tx ? `Invoice ${tx.invoiceNumber}` : `Invoice ${invoiceNumber}`;
    openPrintWindow(title, html);
  };

  return (
    <div className="flex flex-col h-full min-h-0 max-h-full min-w-0 w-full overflow-hidden animate-fade-in">
      {/* Phone only: Services | Cart tabs */}
      <div className="md:hidden shrink-0 flex border-b border-border bg-card">
        <button
          type="button"
          onClick={() => setMobilePanel("services")}
          className={cn(
            "flex-1 inline-flex items-center justify-center gap-2 py-3 text-sm font-medium touch-manipulation border-b-2 transition-colors",
            mobilePanel === "services"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground"
          )}
        >
          <LayoutGrid className="h-4 w-4" />
          Services
        </button>
        <button
          type="button"
          onClick={() => setMobilePanel("cart")}
          className={cn(
            "flex-1 inline-flex items-center justify-center gap-2 py-3 text-sm font-medium touch-manipulation border-b-2 transition-colors",
            mobilePanel === "cart"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground"
          )}
        >
          <ShoppingCart className="h-4 w-4" />
          Cart
          {cart.length > 0 && (
            <span className="inline-flex min-w-[1.25rem] h-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold px-1.5">
              {cart.reduce((n, i) => n + i.quantity, 0)}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 min-h-0 min-w-0 w-full overflow-hidden grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_min(100%,20rem)] lg:grid-cols-[minmax(0,1fr)_min(100%,22rem)] xl:grid-cols-[minmax(0,1fr)_min(100%,24rem)]">
        {/* Left - Service Selection */}
        <div
          className={cn(
            "flex flex-col min-h-0 min-w-0 overflow-hidden border-border transition-opacity duration-500",
            "md:border-r",
            mobilePanel !== "services" && "hidden md:flex",
            checkoutComplete && "md:opacity-50 md:pointer-events-none"
          )}
        >
          {/* Header */}
          <div className="p-3 sm:p-4 border-b border-border space-y-2 sm:space-y-3 shrink-0">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
              <h1 className="text-lg sm:text-xl font-heading font-bold text-foreground shrink-0">POS Billing</h1>
              <div className="w-full min-w-0 xl:max-w-xs">
                <CustomerSearch selectedCustomerId={selectedCustomer} onSelect={setSelectedCustomer} />
              </div>
            </div>
            {activeMembership && (
              <div className="space-y-2 text-xs sm:text-sm rounded-md border border-border bg-secondary/60 px-3 py-2 text-foreground">
                <div>
                  Active membership: <span className="font-medium">{activeMembership.categoryName}</span>
                  {activeMembership.endDate ? ` · until ${activeMembership.endDate}` : ""}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <label htmlFor="pos-membership-user" className="text-muted-foreground shrink-0">
                    Service for
                  </label>
                  <select
                    id="pos-membership-user"
                    value={membershipUserKey}
                    onChange={(e) => setMembershipUserKey(e.target.value)}
                    className="w-full min-w-0 flex-1 px-2 py-2 sm:py-1.5 bg-background border border-border rounded-md text-sm text-foreground"
                  >
                    <option value="holder">Membership holder (customer)</option>
                    {activeMembership.friends.map((f) => (
                      <option key={f.id} value={f.id}>
                        Friend/Family: {f.name}
                        {f.phone ? ` (${f.phone})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-muted-foreground leading-snug">
                  Holder: unlimited = Rs. 0 · Friends: only shareable services redeem; unlimited always payable for
                  friends
                </p>
              </div>
            )}

            {/* Service search */}
            <div className="relative">
              <label htmlFor="pos-service-search" className="sr-only">
                Search services
              </label>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                id="pos-service-search"
                type="text"
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 sm:py-2 bg-secondary text-foreground text-sm rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>

            {/* Category selector */}
            <div className="space-y-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCategoryDropdown((prev) => !prev)}
                  className="w-full sm:w-auto inline-flex items-center justify-between sm:justify-center gap-2 px-3 py-2.5 sm:py-2 rounded-md text-sm font-medium bg-secondary text-foreground border border-border hover:bg-accent transition-colors touch-manipulation"
                >
                  <span>Categories</span>
                  <ChevronDown className="h-4 w-4 shrink-0" />
                </button>
                {showCategoryDropdown && (
                  <div className="absolute z-30 mt-2 w-full sm:w-72 max-w-[calc(100vw-1.5rem)] rounded-md border border-border bg-card shadow-lg p-2 space-y-1 max-h-56 sm:max-h-64 overflow-y-auto">
                    <label className="flex items-center gap-2 px-2 py-2 rounded hover:bg-accent cursor-pointer text-sm touch-manipulation">
                      <input
                        type="checkbox"
                        checked={allCategoryIds.length > 0 && selectedCategoryIds.length === allCategoryIds.length}
                        onChange={(e) => {
                          setSelectedCategoryIds(e.target.checked ? allCategoryIds : []);
                        }}
                      />
                      <span>All categories</span>
                    </label>
                    {serviceCategoriesState.map((cat) => (
                      <label
                        key={cat.id}
                        className="flex items-center gap-2 px-2 py-2 rounded hover:bg-accent cursor-pointer text-sm touch-manipulation"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCategorySet.has(cat.id)}
                          onChange={(e) => {
                            setSelectedCategoryIds((prev) => {
                              if (e.target.checked) return Array.from(new Set([...prev, cat.id]));
                              return prev.filter((id) => id !== cat.id);
                            });
                          }}
                        />
                        <span className="truncate">{cat.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setActiveCategoryFilterId("all")}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-1.5 text-center border transition-colors touch-manipulation",
                    activeCategoryFilterId === "all"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:bg-accent"
                  )}
                >
                  <Check className="h-3.5 w-3.5" />
                  All
                </button>
                {serviceCategoriesState
                  .filter((cat) => selectedCategorySet.has(cat.id))
                  .map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategoryFilterId(cat.id)}
                      className={cn(
                        "shrink-0 max-w-[10rem] truncate px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium text-center border transition-colors touch-manipulation",
                        activeCategoryFilterId === cat.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-foreground border-border hover:bg-accent"
                      )}
                    >
                      {cat.name}
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {/* Packages */}
          <div className="px-3 sm:px-4 pb-2 sm:pb-3 space-y-2 shrink-0 border-b border-border/60">
            <h2 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wide">
              Packages
            </h2>
            {packages.length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">No packages available</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory -mx-1 px-1 [scrollbar-width:thin]">
                {packages.map((pkg) => (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => {
                      addPackageToCart(pkg.id);
                      setMobilePanel("cart");
                    }}
                    className="snap-start shrink-0 w-[9.5rem] sm:w-[11rem] bg-card border border-border rounded-lg px-3 py-2.5 text-left hover:border-primary transition-colors touch-manipulation"
                  >
                    <p className="text-sm font-medium text-card-foreground truncate">{pkg.name}</p>
                    <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
                      {pkg.startDate} – {pkg.endDate}
                    </p>
                    <p className="text-sm font-heading font-bold text-primary mt-1">
                      Rs. {pkg.discountedPrice}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Service Grid */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-4 overscroll-contain">
            {filteredServices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-16">No services found</p>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2 sm:gap-3">
                {filteredServices.map((service) => {
                  const inCart = cart.find((c) => c.serviceId === service.id);
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => addToCart(service.id)}
                      className={cn(
                        "bg-card border rounded-lg overflow-hidden text-left transition-colors hover:border-primary touch-manipulation min-w-0",
                        inCart ? "border-primary ring-1 ring-primary/30" : "border-border"
                      )}
                    >
                      {service.image && (
                        <div className="h-20 sm:h-24 w-full overflow-hidden bg-muted">
                          <img
                            src={service.image}
                            alt={service.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      )}
                      <div className="p-2.5 sm:p-3">
                        <p className="text-xs sm:text-sm font-medium text-card-foreground line-clamp-2 leading-snug">
                          {service.name}
                        </p>
                        <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                          {service.duration} min
                        </p>
                        <div className="flex items-center justify-between gap-1 mt-1.5">
                          <p className="text-sm sm:text-base font-heading font-bold text-primary truncate">
                            Rs. {service.price}
                          </p>
                          {inCart && (
                            <span className="inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1 rounded-full bg-primary text-primary-foreground text-[11px] font-bold shrink-0">
                              {inCart.quantity}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mobile sticky: jump to cart */}
          {cart.length > 0 && !checkoutComplete && (
            <div className="md:hidden shrink-0 border-t border-border p-3 bg-card safe-area-pb">
              <button
                type="button"
                onClick={() => setMobilePanel("cart")}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-md bg-primary text-primary-foreground text-sm font-semibold touch-manipulation"
              >
                <span className="inline-flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  View Cart ({cart.reduce((n, i) => n + i.quantity, 0)})
                </span>
                <span>Rs. {grandTotal.toFixed(2)}</span>
              </button>
            </div>
          )}
        </div>

        {/* Right - Billing Cart */}
        <div
          className={cn(
            "flex flex-col bg-card min-h-0 min-w-0 w-full overflow-hidden border-t md:border-t-0",
            mobilePanel !== "cart" && "hidden md:flex"
          )}
        >
          <AnimatePresence mode="wait">
            {!checkoutComplete ? (
              <motion.div
                key="cart"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col h-full min-h-0"
              >
                {/* Cart header */}
                <div className="p-3 sm:p-4 border-b border-border shrink-0 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-sm font-heading font-semibold text-card-foreground">
                      Cart ({cart.length} {cart.length === 1 ? "item" : "items"})
                    </h2>
                    {customer && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{customer.name}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobilePanel("services")}
                    className="md:hidden shrink-0 text-xs font-medium text-primary px-2 py-1 rounded border border-border touch-manipulation"
                  >
                    + Add
                  </button>
                </div>

                {/* Cart items - scrollable */}
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-4 space-y-3 overscroll-contain">
                  {cart.length === 0 ? (
                    <div className="text-center py-12 px-4 space-y-3">
                      <p className="text-sm text-muted-foreground">Select services to begin</p>
                      <button
                        type="button"
                        onClick={() => setMobilePanel("services")}
                        className="md:hidden inline-flex items-center gap-2 px-4 py-2 rounded-md bg-secondary border border-border text-sm font-medium touch-manipulation"
                      >
                        <LayoutGrid className="h-4 w-4" />
                        Browse services
                      </button>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div
                        key={`${item.serviceId}-${item.membershipRedeemed ? "mem" : "pay"}-${item.membershipFriendId || "holder"}`}
                        className="bg-background border border-border rounded-md p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground break-words">{item.serviceName}</p>
                            {item.membershipRedeemed && (
                              <p className="text-[11px] text-emerald-600 mt-0.5">
                                Membership redeemed · Rs. 0
                                {item.membershipFriendName ? ` · ${item.membershipFriendName}` : ""}
                              </p>
                            )}
                            {!item.membershipRedeemed && item.membershipUsedByType === "friend" && (
                              <p className="text-[11px] text-amber-700 mt-0.5">
                                Friend/Family paid · {item.membershipFriendName || "Friend"}
                              </p>
                            )}
                            <div className="mt-2 space-y-1.5">
                              <p className="text-[11px] text-muted-foreground">Assign employees (max 4)</p>
                              <div className="flex flex-wrap gap-1.5">
                                {employees.map((emp) => {
                                  const assigned = (item.assignedEmployees ?? []).some((a) => a.id === emp.id);
                                  const disableNew = !assigned && (item.assignedEmployees?.length ?? 0) >= 4;
                                  return (
                                    <button
                                      key={emp.id}
                                      type="button"
                                      disabled={disableNew}
                                      onClick={() => toggleAssignedEmployee(item.serviceId, emp.id)}
                                      className={cn(
                                        "px-2.5 py-1.5 rounded border text-[11px] transition-colors touch-manipulation",
                                        assigned
                                          ? "bg-primary text-primary-foreground border-primary"
                                          : "bg-secondary text-muted-foreground border-border hover:bg-accent",
                                        disableNew && "opacity-40 cursor-not-allowed"
                                      )}
                                    >
                                      {emp.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.serviceId)}
                            className="text-muted-foreground hover:text-destructive p-2 -mr-1 -mt-1 touch-manipulation shrink-0"
                            aria-label="Remove item"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-3 gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.serviceId, -1)}
                              className="h-8 w-8 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground touch-manipulation"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="text-sm font-medium w-6 text-center text-foreground">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.serviceId, 1)}
                              className="h-8 w-8 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground touch-manipulation"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <span className="text-sm font-heading font-bold text-foreground shrink-0">
                            Rs. {(item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Cart footer - fixed */}
                <div className="border-t border-border p-3 sm:p-4 space-y-3 shrink-0 max-h-[55%] sm:max-h-none overflow-y-auto overscroll-contain">
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="text-foreground font-medium">Rs. {subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="pos-discount" className="text-muted-foreground">
                        Discount
                      </label>
                      <select
                        id="pos-discount"
                        value={selectedDiscountId}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSelectedDiscountId(value);
                          if (value !== "manual") {
                            setManualDiscount("");
                          }
                        }}
                        className="w-full min-w-0 bg-secondary text-foreground text-sm rounded px-2 py-2 border border-border"
                      >
                        <option value="none">None</option>
                        <option value="manual">Manual amount...</option>
                        {discounts.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} — {d.type === "percentage" ? `${d.value}%` : `Rs. ${d.value}`}
                            {typeof d.maxCap === "number" ? ` (cap Rs. ${d.maxCap})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    {selectedDiscountId === "manual" && (
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="pos-manual-discount" className="text-muted-foreground">
                          Manual discount
                        </label>
                        <input
                          id="pos-manual-discount"
                          type="number"
                          value={manualDiscount}
                          onChange={(e) => setManualDiscount(e.target.value)}
                          className="w-full min-w-0 bg-background text-foreground text-sm rounded px-2 py-2 border border-border"
                          placeholder="Enter amount"
                        />
                      </div>
                    )}
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Discount amount</span>
                        <span className="text-destructive">-Rs. {discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-muted-foreground">
                      <span>
                        Tax ({((Number.isFinite(settings.taxRate) ? settings.taxRate : 0) * 100).toFixed(2)}%)
                      </span>
                      <span className="text-foreground">Rs. {tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-base font-heading font-bold pt-2 border-t border-border text-foreground">
                      <span>Grand Total</span>
                      <span>Rs. {grandTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="pos-paid-amount" className="text-muted-foreground">
                        Paid now
                      </label>
                      <input
                        id="pos-paid-amount"
                        type="number"
                        value={paidInput}
                        onChange={(e) => setPaidInput(e.target.value)}
                        className="w-full min-w-0 bg-background text-foreground text-sm rounded px-2 py-2 border border-border"
                        placeholder={`Full: ${grandTotal.toFixed(2)}`}
                      />
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Remaining balance</span>
                      <span className="text-destructive">
                        Rs.{" "}
                        {(billingMode === "existing_due" ? dueRemainingAfterPayment : remainingBalance).toFixed(2)}
                      </span>
                    </div>
                    {customerBalanceSummary && (
                      <div className="text-xs text-muted-foreground rounded border border-border p-2 space-y-0.5">
                        {hasOutstandingDue && (
                          <div className="flex flex-col gap-1.5 pb-1 mb-1 border-b border-border">
                            <p className="text-foreground font-medium">Billing option</p>
                            <label className="inline-flex items-center gap-2 touch-manipulation">
                              <input
                                type="radio"
                                checked={billingMode === "existing_due"}
                                onChange={() => setBillingMode("existing_due")}
                              />
                              Apply payment to existing due
                            </label>
                            <label className="inline-flex items-center gap-2 touch-manipulation">
                              <input
                                type="radio"
                                checked={billingMode === "new_invoice"}
                                onChange={() => setBillingMode("new_invoice")}
                              />
                              Create new invoice
                            </label>
                          </div>
                        )}
                        {!hasOutstandingDue && (
                          <div className="flex flex-col gap-1.5 pb-1 mb-1 border-b border-border">
                            <p className="text-foreground font-medium">Billing option</p>
                            <label className="inline-flex items-center gap-2 touch-manipulation">
                              <input
                                type="radio"
                                checked={billingMode === "new_invoice"}
                                onChange={() => setBillingMode("new_invoice")}
                              />
                              Create new invoice
                            </label>
                          </div>
                        )}
                        <p>Customer total billed: Rs. {customerBalanceSummary.total_amount.toFixed(2)}</p>
                        <p>Total paid: Rs. {customerBalanceSummary.paid_amount.toFixed(2)}</p>
                        <p>Outstanding dues: Rs. {customerBalanceSummary.remaining_balance.toFixed(2)}</p>
                      </div>
                    )}
                    {checkoutError && <p className="text-xs text-destructive">{checkoutError}</p>}
                  </div>

                  {/* Checkout buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleCheckout("cash")}
                      disabled={!canCheckout}
                      className="flex flex-col items-center gap-1 py-3 rounded-md bg-success text-success-foreground text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity touch-manipulation"
                    >
                      <Banknote className="h-4 w-4" />
                      Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCheckout("card")}
                      disabled={!canCheckout}
                      className="flex flex-col items-center gap-1 py-3 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity touch-manipulation"
                    >
                      <CreditCard className="h-4 w-4" />
                      Card
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCheckout("online")}
                      disabled={!canCheckout}
                      className="flex flex-col items-center gap-1 py-3 rounded-md bg-secondary text-secondary-foreground text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity border border-border touch-manipulation"
                    >
                      <Globe className="h-4 w-4" />
                      Online
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="receipt"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col h-full min-h-0"
              >
                <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 space-y-6 overflow-y-auto">
                  <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
                    <FileText className="h-8 w-8 text-success" />
                  </div>
                  <div className="text-center">
                    <h2 className="text-lg font-heading font-bold text-card-foreground">Payment Complete</h2>
                    <p className="text-sm text-muted-foreground mt-1">Invoice {completedInvoiceNumber}</p>
                    <p className="text-2xl font-heading font-bold text-foreground mt-3">
                      Rs. {completedAmount.toFixed(2)}
                    </p>
                  </div>

                  <div className="w-full max-w-sm space-y-2">
                    <button
                      type="button"
                      onClick={printInvoice}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity touch-manipulation"
                    >
                      <Printer className="h-4 w-4" />
                      Print Invoice
                    </button>
                    <button
                      type="button"
                      onClick={printInvoice}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-secondary text-secondary-foreground rounded-md text-sm font-medium border border-border hover:bg-accent transition-colors touch-manipulation"
                    >
                      <Download className="h-4 w-4" />
                      Download PDF
                    </button>
                  </div>
                </div>

                <div className="border-t border-border p-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      handleNewTransaction();
                      setMobilePanel("services");
                    }}
                    className="w-full py-3 bg-foreground text-background rounded-md text-sm font-heading font-semibold hover:opacity-90 transition-opacity touch-manipulation"
                  >
                    New Transaction
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default POSBilling;
