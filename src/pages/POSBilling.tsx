import { useEffect, useState } from "react";
import { Service, ServiceCategory, Customer, Employee, Package, Discount, CartItem, Transaction } from "@/types/pos";
import { cn } from "@/lib/utils";
import { X, Minus, Plus, Search, CreditCard, Banknote, Globe, FileText, Printer, Download } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { CustomerSearch } from "@/components/CustomerSearch";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from "@/lib/appSettings";
import { DEFAULT_DISCOUNTS, DISCOUNTS_STORAGE_KEY } from "@/lib/discounts";
import { openPrintWindow, buildProfessionalInvoiceHtml } from "@/lib/exporting";
import { useAuth } from "@/contexts/AuthContext";

const TRANSACTIONS_API_BASE = "https://saddlebrown-antelope-612005.hostingersite.com/transactions.php";
const SERVICES_API_BASE = "https://saddlebrown-antelope-612005.hostingersite.com/services.php";
const CUSTOMERS_API_BASE = "https://saddlebrown-antelope-612005.hostingersite.com/customers.php";
const EMPLOYEES_API_BASE = "https://saddlebrown-antelope-612005.hostingersite.com/employees.php";
const PACKAGES_API_BASE = "https://saddlebrown-antelope-612005.hostingersite.com/packages.php";
const DISCOUNTS_API_BASE = "https://saddlebrown-antelope-612005.hostingersite.com/discounts.php";

const POSBilling = () => {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [serviceCategoriesState, setServiceCategoriesState] = useState<ServiceCategory[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>(DEFAULT_DISCOUNTS);

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
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
            return {
              id: String(row.id),
              name: String(row.name),
              categoryId: catId,
              price: Number(row.price),
              duration: Number(row.duration),
              active: Boolean(row.active),
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
          if (!selectedCustomer && mappedCustomers.length > 0) {
            setSelectedCustomer(mappedCustomers[0].id);
          }
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

  const filteredServices = services.filter((s) => {
    const matchesCategory = selectedCategory === "all" || s.categoryId === selectedCategory;
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch && s.active;
  });

  const addToCart = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    if (!service) return;

    const existing = cart.find((c) => c.serviceId === serviceId);
    if (existing) {
      setCart(cart.map((c) => (c.serviceId === serviceId ? { ...c, quantity: c.quantity + 1 } : c)));
    } else {
      setCart([
        ...cart,
        {
          serviceId: service.id,
          serviceName: service.name,
          price: service.price,
          quantity: 1,
          employeeId: employees[0].id,
          employeeName: employees[0].name,
        },
      ]);
    }
  };

  const addPackageToCart = (packageId: string) => {
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

  const updateEmployee = (serviceId: string, employeeId: string) => {
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return;
    setCart(cart.map((c) => (c.serviceId === serviceId ? { ...c, employeeId, employeeName: emp.name } : c)));
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

  const handleCheckout = (method: "cash" | "card" | "online") => {
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
    };

    const submit = async () => {
      try {
        await fetch(TRANSACTIONS_API_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tx),
        });
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
    setInvoiceNumber(`${settings.invoicePrefix}${String(Math.floor(Math.random() * 9000) + 1000)}`);
  };

  const customer = customers.find((c) => c.id === selectedCustomer);

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
    });
  };

  const printInvoice = () => {
    const tx = originalTransaction;
    const html = tx ? buildInvoiceHtmlFromTx(tx) : buildInvoiceHtmlFromCart();
    const title = tx ? `Invoice ${tx.invoiceNumber}` : `Invoice ${invoiceNumber}`;
    openPrintWindow(title, html);
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen min-h-[100dvh] max-h-screen overflow-hidden animate-fade-in">
      {/* Left - Service Selection ~60% */}
      <div
        className={cn(
          "flex flex-col min-h-0 flex-1 lg:flex-[3] border-b lg:border-b-0 lg:border-r border-border transition-opacity duration-500",
          checkoutComplete && "opacity-50 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-border space-y-2 sm:space-y-3 shrink-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-lg sm:text-xl font-heading font-bold text-foreground">POS Billing</h1>
            <CustomerSearch selectedCustomerId={selectedCustomer} onSelect={setSelectedCustomer} />
          </div>

          {/* Service search */}
          <div className="relative">
            <label htmlFor="pos-service-search" className="sr-only">
              Search services
            </label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              id="pos-service-search"
              type="text"
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-secondary text-foreground text-sm rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>

          {/* Category tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 scrollbar-thin">
            <button
              onClick={() => setSelectedCategory("all")}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
                selectedCategory === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              All
            </button>
            {serviceCategoriesState.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
                  selectedCategory === cat.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

      {/* Packages */}
      <div className="px-3 sm:px-4 pb-2 sm:pb-3 space-y-2 shrink-0">
        <h2 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wide">
          Packages
        </h2>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1">
          {packages.map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => addPackageToCart(pkg.id)}
              className="min-w-[140px] sm:min-w-[180px] bg-card border border-border rounded-lg px-3 py-2 text-left hover:border-primary transition-colors touch-manipulation"
            >
              <p className="text-sm font-medium text-card-foreground truncate">{pkg.name}</p>
              <p className="text-xs text-muted-foreground">
                {pkg.startDate} – {pkg.endDate}
              </p>
              <p className="text-sm font-heading font-bold text-primary mt-1">Rs. {pkg.discountedPrice}</p>
            </button>
          ))}
        </div>
      </div>

        {/* Service Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-4">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {filteredServices.map((service) => {
              const inCart = cart.find((c) => c.serviceId === service.id);
              return (
                <button
                  key={service.id}
                  onClick={() => addToCart(service.id)}
                  className={cn(
                    "bg-card border rounded-lg overflow-hidden text-left transition-colors hover:border-primary",
                    inCart ? "border-primary" : "border-border"
                  )}
                >
                  {service.image && (
                    <div className="h-24 w-full overflow-hidden bg-muted">
                      <img src={service.image} alt={service.name} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="p-3">
                    <p className="text-sm font-medium text-card-foreground">{service.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{service.duration} min</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-base font-heading font-bold text-primary">Rs. {service.price}</p>
                      {inCart && (
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                          {inCart.quantity}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right - Billing Cart ~40% */}
      <div className="flex flex-col bg-card w-full lg:flex-[2] lg:max-w-md min-h-0 lg:min-h-full shrink-0 lg:shrink">
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
              <div className="p-3 sm:p-4 border-b border-border shrink-0">
                <h2 className="text-sm font-heading font-semibold text-card-foreground">
                  Cart ({cart.length} {cart.length === 1 ? "item" : "items"})
                </h2>
                {customer && <p className="text-xs text-muted-foreground mt-0.5">{customer.name}</p>}
              </div>

              {/* Cart items - scrollable */}
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-4 space-y-3">
                {cart.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">Select services to begin</p>
                ) : (
                  cart.map((item) => (
                    <div key={item.serviceId} className="bg-background border border-border rounded-md p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{item.serviceName}</p>
                          <label htmlFor={`pos-employee-${item.serviceId}`} className="sr-only">
                            Employee
                          </label>
                          <select
                            id={`pos-employee-${item.serviceId}`}
                            value={item.employeeId}
                            onChange={(e) => updateEmployee(item.serviceId, e.target.value)}
                            className="mt-1 text-xs bg-secondary text-muted-foreground rounded px-2 py-1 border border-border"
                          >
                            {employees.map((emp) => (
                              <option key={emp.id} value={emp.id}>{emp.name}</option>
                            ))}
                          </select>
                        </div>
                        <button onClick={() => removeFromCart(item.serviceId)} className="text-muted-foreground hover:text-destructive p-1">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQuantity(item.serviceId, -1)} className="h-6 w-6 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground">
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-sm font-medium w-4 text-center text-foreground">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.serviceId, 1)} className="h-6 w-6 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="text-sm font-heading font-bold text-foreground">Rs. {(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Cart footer - fixed */}
              <div className="border-t border-border p-3 sm:p-4 space-y-3 shrink-0">
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="text-foreground font-medium">Rs. {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
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
                      className="w-full sm:w-auto min-w-0 flex-1 sm:min-w-[11rem] bg-secondary text-foreground text-sm rounded px-2 py-1 border border-border"
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
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
                      <label htmlFor="pos-manual-discount" className="text-muted-foreground">
                        Manual discount
                      </label>
                      <input
                        id="pos-manual-discount"
                        type="number"
                        value={manualDiscount}
                        onChange={(e) => setManualDiscount(e.target.value)}
                        className="w-full sm:w-auto min-w-0 flex-1 sm:min-w-[11rem] bg-background text-foreground text-sm rounded px-2 py-1 border border-border"
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
                    <span>Tax ({((Number.isFinite(settings.taxRate) ? settings.taxRate : 0) * 100).toFixed(2)}%)</span>
                    <span className="text-foreground">Rs. {tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-heading font-bold pt-2 border-t border-border text-foreground">
                    <span>Grand Total</span>
                    <span>Rs. {grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Checkout buttons */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  <button
                    onClick={() => handleCheckout("cash")}
                    disabled={cart.length === 0}
                    className="flex flex-col items-center gap-0.5 sm:gap-1 py-2.5 sm:py-3 rounded-md bg-success text-success-foreground text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity touch-manipulation"
                  >
                    <Banknote className="h-4 w-4" />
                    Cash
                  </button>
                  <button
                    onClick={() => handleCheckout("card")}
                    disabled={cart.length === 0}
                    className="flex flex-col items-center gap-0.5 sm:gap-1 py-2.5 sm:py-3 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity touch-manipulation"
                  >
                    <CreditCard className="h-4 w-4" />
                    Card
                  </button>
                  <button
                    onClick={() => handleCheckout("online")}
                    disabled={cart.length === 0}
                    className="flex flex-col items-center gap-0.5 sm:gap-1 py-2.5 sm:py-3 rounded-md bg-secondary text-secondary-foreground text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity border border-border touch-manipulation"
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
              className="flex flex-col h-full"
            >
              <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
                <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
                  <FileText className="h-8 w-8 text-success" />
                </div>
                <div className="text-center">
                  <h2 className="text-lg font-heading font-bold text-card-foreground">Payment Complete</h2>
                  <p className="text-sm text-muted-foreground mt-1">Invoice {invoiceNumber}</p>
                  <p className="text-2xl font-heading font-bold text-foreground mt-3">
                    Rs. {grandTotal.toFixed(2)}
                  </p>
                </div>

                <div className="w-full space-y-2">
                  <button
                    onClick={printInvoice}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    <Printer className="h-4 w-4" />
                    Print Invoice
                  </button>
                  <button
                    onClick={printInvoice}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-secondary text-secondary-foreground rounded-md text-sm font-medium border border-border hover:bg-accent transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Download PDF
                  </button>
                </div>
              </div>

              <div className="border-t border-border p-4">
                <button
                  onClick={handleNewTransaction}
                  className="w-full py-2.5 bg-foreground text-background rounded-md text-sm font-heading font-semibold hover:opacity-90 transition-opacity"
                >
                  New Transaction
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default POSBilling;
