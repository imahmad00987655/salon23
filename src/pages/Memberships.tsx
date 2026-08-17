import { useCallback, useEffect, useState } from "react";
import {
  Membership,
  MembershipCategory,
  MembershipCategoryService,
  MembershipFriend,
  MembershipServiceUsage,
  MembershipUsageRecord,
  Customer,
} from "@/types/pos";
import {
  Plus,
  X,
  Users,
  CreditCard,
  Eye,
  UserPlus,
  Ban,
  Pencil,
  BadgeCheck,
  Printer,
} from "lucide-react";
import { getApiOrigin } from "@/lib/apiBase";
import { openPrintWindow, buildMembershipInvoiceHtml } from "@/lib/exporting";

const API_BASE = `${getApiOrigin()}/memberships.php`;
const CUSTOMERS_API = `${getApiOrigin()}/customers.php`;
const SERVICES_API = `${getApiOrigin()}/services.php`;

type Tab = "memberships" | "categories";

type CatalogService = {
  id: string;
  name: string;
  price: number;
  active: boolean;
};

type CategoryServiceRow = {
  serviceId: string;
  serviceName: string;
  servicePrice: string;
  /** "" = not included, "0" = ∞ unlimited for holder, "1"+ = limited */
  quantity: string;
  shareable: boolean;
};

const emptyServiceRow = (): CategoryServiceRow => ({
  serviceId: "",
  serviceName: "",
  servicePrice: "",
  quantity: "",
  shareable: true,
});

const statusClass = (status: string) => {
  switch (status) {
    case "active":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "upcoming":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-400";
    case "expired":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "cancelled":
      return "bg-destructive/15 text-destructive";
    default:
      return "bg-secondary text-secondary-foreground";
  }
};

const formatAllowed = (allowed: number | null | undefined) => {
  if (allowed === null || allowed === undefined) return "Not included";
  if (Number(allowed) === 0) return "Unlimited";
  return String(allowed);
};

const formatRemaining = (allowed: number | null | undefined, used: number) => {
  if (allowed === null || allowed === undefined) return "—";
  if (Number(allowed) === 0) return "Unlimited";
  return String(Math.max(0, Number(allowed) - Number(used || 0)));
};

const servicesSummaryText = (m: Membership) => {
  const s = m.servicesSummary;
  if (s) {
    const parts: string[] = [];
    if (s.unlimited > 0) parts.push(`${s.unlimited} unlimited`);
    if (s.limitedRemaining > 0 || (s.included - s.unlimited) > 0) {
      parts.push(`${s.limitedRemaining} remaining`);
    }
    if (parts.length === 0) return `${s.included} included`;
    return parts.join(" · ");
  }
  const services = m.services ?? [];
  const included = services.filter((svc) => svc.allowedQty !== null && svc.allowedQty !== undefined);
  let used = 0;
  let remaining = 0;
  let unlimited = 0;
  for (const svc of included) {
    used += Number(svc.usedQty || 0);
    if (Number(svc.allowedQty) === 0) unlimited += 1;
    else remaining += Math.max(0, Number(svc.allowedQty) - Number(svc.usedQty || 0));
  }
  if (unlimited > 0) return `${used} used · ${remaining} left · ${unlimited} unlimited`;
  return `${used} used / ${remaining} remaining`;
};

const usedTotalText = (m: Membership) => {
  if (m.servicesSummary?.usedTotal != null) return String(m.servicesSummary.usedTotal);
  const services = m.services ?? [];
  return String(services.reduce((sum, svc) => sum + Number(svc.usedQty || 0), 0));
};

const remainingText = (m: Membership) => {
  const s = m.servicesSummary;
  if (s) {
    const parts: string[] = [String(s.limitedRemaining ?? 0)];
    if (s.unlimited > 0) parts.push(`${s.unlimited} unlimited`);
    return parts.join(" · ");
  }
  const services = m.services ?? [];
  let remaining = 0;
  let unlimited = 0;
  for (const svc of services) {
    if (svc.allowedQty === null || svc.allowedQty === undefined) continue;
    if (Number(svc.allowedQty) === 0) unlimited += 1;
    else remaining += Math.max(0, Number(svc.allowedQty) - Number(svc.usedQty || 0));
  }
  if (unlimited > 0) return `${remaining} · ${unlimited} unlimited`;
  return String(remaining);
};

const friendsDisplayText = (m: Membership) => {
  const items =
    m.friendsSummary && m.friendsSummary.length > 0
      ? m.friendsSummary
      : (m.friends ?? []).map((f) => (f.phone ? `${f.name} (${f.phone})` : f.name));
  if (items.length === 0) return "—";
  if (items.length <= 2) return items.join(", ");
  return `${items.slice(0, 2).join(", ")} +${items.length - 2}`;
};

const usageUsedByLabel = (u: MembershipUsageRecord) => {
  if (u.usedByType === "friend" || u.friendName) {
    return u.friendName || "Friend";
  }
  return "Holder";
};

const mapCategory = (row: Record<string, unknown>): MembershipCategory => {
  const servicesRaw = (row.services as Record<string, unknown>[] | undefined) ?? [];
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    durationMonths: Number(row.duration_months ?? row.durationMonths ?? 3),
    discountPercent: Number(row.discount_percent ?? row.discountPercent ?? 0),
    price: Number(row.price ?? 0),
    priceBeforeDiscount: Number(row.price_before_discount ?? row.priceBeforeDiscount ?? 0),
    shareable: Boolean(Number(row.shareable ?? 1)),
    active: Boolean(Number(row.active ?? 1)),
    terms: row.terms != null ? String(row.terms) : undefined,
    services: servicesRaw.map(
      (s): MembershipCategoryService => ({
        id: s.id != null ? String(s.id) : undefined,
        serviceId: s.service_id != null || s.serviceId != null
          ? String(s.service_id ?? s.serviceId)
          : undefined,
        serviceName: String(s.service_name ?? s.serviceName ?? ""),
        servicePrice: Number(s.service_price ?? s.servicePrice ?? 0),
        quantity:
          s.quantity === null || s.quantity === undefined || s.quantity === ""
            ? null
            : Number(s.quantity),
        shareable: Boolean(Number(s.shareable ?? 1)),
      })
    ),
  };
};

const mapMembership = (row: Record<string, unknown>): Membership => {
  const servicesRaw = (row.services as Record<string, unknown>[] | undefined) ?? [];
  const friendsRaw = (row.friends as Record<string, unknown>[] | undefined) ?? [];
  const usageRaw = (row.usage as Record<string, unknown>[] | undefined) ?? [];
  const summary = row.services_summary as Record<string, unknown> | undefined;

  const friends = friendsRaw.map(
    (f): MembershipFriend => ({
      id: String(f.id),
      membershipId: String(f.membership_id ?? f.membershipId ?? row.id),
      name: String(f.name ?? ""),
      phone: String(f.phone ?? ""),
      relationship: f.relationship != null ? String(f.relationship) : undefined,
    })
  );

  return {
    id: String(row.id),
    customerId: String(row.customer_id ?? row.customerId ?? ""),
    customerName: String(row.customer_name ?? row.customerName ?? ""),
    customerPhone: String(row.customer_phone ?? row.customerPhone ?? ""),
    categoryId: String(row.category_id ?? row.categoryId ?? ""),
    categoryName: String(row.category_name ?? row.categoryName ?? ""),
    durationMonths: Number(row.duration_months ?? row.durationMonths ?? 0),
    discountPercent: Number(row.discount_percent ?? row.discountPercent ?? 0),
    price: Number(row.price ?? 0),
    startDate: String(row.start_date ?? row.startDate ?? ""),
    endDate: String(row.end_date ?? row.endDate ?? ""),
    status: String(row.status ?? "active") as Membership["status"],
    invoiceNumber: String(row.invoice_number ?? row.invoiceNumber ?? ""),
    paymentStatus: String(row.payment_status ?? row.paymentStatus ?? "paid") as Membership["paymentStatus"],
    paidAmount: Number(row.paid_amount ?? row.paidAmount ?? 0),
    notes: row.notes != null ? String(row.notes) : undefined,
    terms: row.terms != null ? String(row.terms) : undefined,
    friendsCount: friends.length || Number(row.friends_count ?? row.friendsCount ?? 0),
    friendsSummary: Array.isArray(row.friends_summary)
      ? row.friends_summary.map(String)
      : friends.map((f) => (f.phone ? `${f.name} (${f.phone})` : f.name)),
    services: servicesRaw.map(
      (s): MembershipServiceUsage => ({
        id: String(s.id ?? ""),
        serviceId: s.service_id != null || s.serviceId != null
          ? String(s.service_id ?? s.serviceId)
          : undefined,
        serviceName: String(s.service_name ?? s.serviceName ?? ""),
        servicePrice: Number(s.service_price ?? s.servicePrice ?? 0),
        allowedQty:
          s.allowed_qty === null || s.allowed_qty === undefined
            ? s.allowedQty === null || s.allowedQty === undefined
              ? null
              : Number(s.allowedQty)
            : Number(s.allowed_qty),
        usedQty: Number(s.used_qty ?? s.usedQty ?? 0),
        shareable: Boolean(Number(s.shareable ?? 1)),
      })
    ),
    friends,
    usage: usageRaw.map(
      (u): MembershipUsageRecord => ({
        id: String(u.id ?? ""),
        serviceName: String(u.service_name ?? u.serviceName ?? ""),
        usedByType: String(u.used_by_type ?? u.usedByType ?? "holder"),
        friendName: u.friend_name != null || u.friendName != null
          ? String(u.friend_name ?? u.friendName)
          : undefined,
        friendPhone: u.friend_phone != null || u.friendPhone != null
          ? String(u.friend_phone ?? u.friendPhone)
          : undefined,
        quantity: Number(u.quantity ?? 1),
        status: String(u.status ?? "redeemed"),
        amountCharged: Number(u.amount_charged ?? u.amountCharged ?? 0),
        usageDate: String(u.usage_date ?? u.usageDate ?? ""),
      })
    ),
    servicesSummary: summary
      ? {
          included: Number(summary.included ?? 0),
          unlimited: Number(summary.unlimited ?? 0),
          limitedRemaining: Number(summary.limited_remaining ?? summary.limitedRemaining ?? 0),
          usedTotal: Number(summary.used_total ?? summary.usedTotal ?? 0),
          totalServices: Number(summary.total_services ?? summary.totalServices ?? 0),
        }
      : undefined,
  };
};

const Memberships = () => {
  const [tab, setTab] = useState<Tab>("memberships");
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [categories, setCategories] = useState<MembershipCategory[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Assign membership modal
  const [showAssign, setShowAssign] = useState(false);
  const [assignCustomerId, setAssignCustomerId] = useState("");
  const [assignCategoryId, setAssignCategoryId] = useState("");
  const [assignStartDate, setAssignStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [assignEndDate, setAssignEndDate] = useState("");
  const [assignPaymentStatus] = useState<"paid">("paid");
  const [assignPaidAmount, setAssignPaidAmount] = useState("");
  const [assignPaymentMethod, setAssignPaymentMethod] = useState<"cash" | "card" | "online">("cash");

  const addMonthsMinusOneDay = (ymd: string, months: number): string => {
    const d = new Date(`${ymd}T12:00:00`);
    if (Number.isNaN(d.getTime())) return ymd;
    d.setMonth(d.getMonth() + months);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  };

  const applyCategoryDefaults = (categoryId: string, startDate?: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    const start = startDate || assignStartDate || new Date().toISOString().slice(0, 10);
    setAssignCategoryId(categoryId);
    setAssignStartDate(start);
    if (cat) {
      setAssignEndDate(addMonthsMinusOneDay(start, Number(cat.durationMonths) || 0));
      setAssignPaidAmount(String(Number(cat.price) || 0));
    } else {
      setAssignEndDate("");
      setAssignPaidAmount("");
    }
  };

  const resetAssignForm = () => {
    setAssignCustomerId("");
    setAssignCategoryId("");
    setAssignStartDate(new Date().toISOString().slice(0, 10));
    setAssignEndDate("");
    setAssignPaidAmount("");
    setAssignPaymentMethod("cash");
    setCustomerSearch("");
  };
  const [customerSearch, setCustomerSearch] = useState("");

  // Category form modal
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MembershipCategory | null>(null);
  const [categoryServiceRows, setCategoryServiceRows] = useState<CategoryServiceRow[]>([emptyServiceRow()]);
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");

  // Detail modal
  const [detail, setDetail] = useState<Membership | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Edit membership modal
  const [showEdit, setShowEdit] = useState(false);
  const [editingMembership, setEditingMembership] = useState<Membership | null>(null);

  // Add friend (standalone or inside detail)
  const [showFriendForm, setShowFriendForm] = useState(false);
  const [friendMembershipId, setFriendMembershipId] = useState<string | null>(null);

  const loadMemberships = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}?resource=memberships`);
      if (!res.ok) throw new Error("Failed to load memberships");
      const raw = (await res.json()) as Record<string, unknown>[];
      setMemberships((raw || []).map(mapMembership));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}?resource=categories`);
      if (!res.ok) throw new Error("Failed to load categories");
      const raw = (await res.json()) as Record<string, unknown>[];
      setCategories((raw || []).map(mapCategory));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const loadCustomers = useCallback(async (query = "") => {
    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (query.trim()) params.set("search", query.trim());
      const res = await fetch(`${CUSTOMERS_API}?${params.toString()}`);
      if (!res.ok) return;
      const raw = (await res.json()) as Record<string, unknown>[];
      setCustomers(
        (raw || []).map((row) => ({
          id: String(row.id),
          name: String(row.name ?? ""),
          phone: String(row.phone ?? ""),
          email: String(row.email ?? ""),
          notes: String(row.notes ?? ""),
          preferences: String(row.preferences ?? ""),
          lastVisit: String(row.last_visit ?? row.lastVisit ?? ""),
          visitCount: Number(row.visit_count ?? row.visitCount ?? 0),
          active: Boolean(row.active ?? 1),
        }))
      );
    } catch {
      setCustomers([]);
    }
  }, []);

  const loadCatalogServices = useCallback(async () => {
    try {
      const res = await fetch(SERVICES_API);
      if (!res.ok) return;
      const raw = (await res.json()) as Record<string, unknown>[];
      setCatalogServices(
        (raw || [])
          .map((row) => ({
            id: String(row.id),
            name: String(row.name ?? ""),
            price: Number(row.price ?? 0),
            active: Boolean(Number(row.active ?? 1)),
          }))
          .filter((s) => s.active && s.name)
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch {
      setCatalogServices([]);
    }
  }, []);

  useEffect(() => {
    void loadMemberships();
    void loadCategories();
    void loadCatalogServices();
  }, [loadMemberships, loadCategories, loadCatalogServices]);

  useEffect(() => {
    if (!showAssign) return;
    const t = window.setTimeout(() => void loadCustomers(customerSearch), 250);
    return () => window.clearTimeout(t);
  }, [showAssign, customerSearch, loadCustomers]);

  const openDetail = async (id: string) => {
    try {
      setDetailLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}?id=${id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to load membership");
      }
      const raw = (await res.json()) as Record<string, unknown>;
      setDetail(mapMembership(raw));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchMembershipDetail = async (id: string): Promise<Membership> => {
    const res = await fetch(`${API_BASE}?id=${id}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || "Failed to load membership");
    }
    const raw = (await res.json()) as Record<string, unknown>;
    return mapMembership(raw);
  };

  const printMembershipInvoice = async (m: Membership) => {
    try {
      setError(null);
      let membership = m;
      if (!membership.services || membership.services.length === 0) {
        membership = await fetchMembershipDetail(m.id);
      }
      const html = buildMembershipInvoiceHtml({
        invoiceNumber: membership.invoiceNumber,
        customerName: membership.customerName,
        customerPhone: membership.customerPhone,
        membershipName: membership.categoryName,
        startDate: membership.startDate,
        endDate: membership.endDate,
        durationMonths: membership.durationMonths,
        discountPercent: membership.discountPercent,
        price: membership.price,
        paidAmount: membership.paidAmount,
        paymentStatus: membership.paymentStatus,
        terms:
          membership.terms ||
          `${membership.categoryName}: ${membership.discountPercent}% · ${membership.durationMonths} months`,
        services: (membership.services ?? []).map((s) => ({
          serviceName: s.serviceName,
          quantity: s.allowedQty,
          servicePrice: s.servicePrice,
        })),
      });
      openPrintWindow(`Membership ${membership.invoiceNumber}`, html);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const openEdit = (m: Membership) => {
    setEditingMembership(m);
    setShowEdit(true);
  };

  const handleEditMembership = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingMembership) return;
    const fd = new FormData(e.currentTarget);
    const payload = {
      startDate: String(fd.get("startDate") ?? ""),
      endDate: String(fd.get("endDate") ?? ""),
      paymentStatus: String(fd.get("paymentStatus") || "paid"),
      paidAmount: Number(fd.get("paidAmount") || 0),
      notes: String(fd.get("notes") ?? "").trim(),
      status: String(fd.get("status") || editingMembership.status),
    };

    const submit = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE}?id=${editingMembership.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((body as { error?: string }).error || "Failed to update membership");
        }
        setShowEdit(false);
        setEditingMembership(null);
        await loadMemberships();
        if (detail?.id === editingMembership.id) {
          await openDetail(editingMembership.id);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void submit();
  };

  const handleCancel = async (m: Membership) => {
    if (m.status === "cancelled") return;
    if (!window.confirm(`Cancel membership for ${m.customerName}?`)) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}?id=${m.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body as { error?: string }).error || "Failed to cancel membership");
      }
      await loadMemberships();
      if (detail?.id === m.id) {
        setDetail(mapMembership(body as Record<string, unknown>));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!assignCustomerId || !assignCategoryId || !assignStartDate) {
      setError("Customer, category and start date are required");
      return;
    }
    const payload: Record<string, unknown> = {
      customerId: Number(assignCustomerId),
      categoryId: Number(assignCategoryId),
      startDate: assignStartDate,
      endDate: assignEndDate || undefined,
      paymentStatus: assignPaymentStatus || "paid",
      paidAmount: Number(assignPaidAmount || 0),
      paymentMethod: assignPaymentMethod || "cash",
    };

    const submit = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(API_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || "Failed to assign membership");
        }
        await loadMemberships();
        setShowAssign(false);
        resetAssignForm();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void submit();
  };

  const openCategoryForm = (cat: MembershipCategory | null = null) => {
    setEditingCategory(cat);
    setServiceSearch("");
    void loadCatalogServices();
    if (cat && cat.services.length > 0) {
      setCategoryServiceRows(
        cat.services.map((s) => ({
          serviceId: s.serviceId ? String(s.serviceId) : "",
          serviceName: s.serviceName,
          servicePrice: String(s.servicePrice ?? ""),
          quantity: s.quantity === null || s.quantity === undefined ? "" : String(s.quantity),
          shareable: s.shareable !== false,
        }))
      );
    } else {
      setCategoryServiceRows([emptyServiceRow()]);
    }
    setShowCategoryForm(true);
  };

  const applyServiceToRow = (idx: number, serviceId: string) => {
    const svc = catalogServices.find((s) => s.id === serviceId);
    setCategoryServiceRows((rows) => {
      const next = [...rows];
      if (!svc) {
        next[idx] = { ...next[idx], serviceId: "", serviceName: "", servicePrice: "" };
      } else {
        next[idx] = {
          ...next[idx],
          serviceId: svc.id,
          serviceName: svc.name,
          servicePrice: String(svc.price),
        };
      }
      return next;
    });
  };

  const handleSaveCategory = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const services = categoryServiceRows
      .filter((r) => r.serviceId || r.serviceName.trim())
      .map((r) => ({
        serviceId: r.serviceId ? Number(r.serviceId) : null,
        serviceName: r.serviceName.trim(),
        servicePrice: Number(r.servicePrice || 0),
        quantity: r.quantity.trim() === "" ? null : Number(r.quantity),
        shareable: r.shareable,
      }));

    const payload = {
      name: String(fd.get("name") ?? "").trim(),
      durationMonths: Number(fd.get("durationMonths") || 3),
      discountPercent: Number(fd.get("discountPercent") || 0),
      price: Number(fd.get("price") || 0),
      priceBeforeDiscount: Number(fd.get("priceBeforeDiscount") || 0),
      active: fd.get("active") === "on",
      services,
    };

    const submit = async () => {
      try {
        setLoading(true);
        setError(null);
        const isEdit = Boolean(editingCategory);
        const url = isEdit
          ? `${API_BASE}?resource=categories&id=${editingCategory!.id}`
          : `${API_BASE}?resource=categories`;
        const res = await fetch(url, {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || "Failed to save category");
        }
        await loadCategories();
        setShowCategoryForm(false);
        setEditingCategory(null);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void submit();
  };

  const handleAddFriend = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!friendMembershipId) return;
    const fd = new FormData(e.currentTarget);
    const payload = {
      membershipId: Number(friendMembershipId),
      name: String(fd.get("name") ?? "").trim(),
      phone: String(fd.get("phone") ?? "").trim(),
      relationship: String(fd.get("relationship") ?? "").trim(),
    };

    const submit = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE}?resource=friends`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || "Failed to add friend");
        }
        setShowFriendForm(false);
        setFriendMembershipId(null);
        await loadMemberships();
        if (detail?.id === friendMembershipId) {
          await openDetail(friendMembershipId);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void submit();
  };

  const openFriendForm = (membershipId: string) => {
    setFriendMembershipId(membershipId);
    setShowFriendForm(true);
  };

  const filteredCustomers = customers.filter(
    (c) =>
      !customerSearch.trim() ||
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone.includes(customerSearch)
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Memberships</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading
              ? "Loading..."
              : tab === "memberships"
                ? `${memberships.length} purchased memberships`
                : `${categories.length} categories`}
          </p>
          {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {tab === "memberships" && (
            <button
              type="button"
              onClick={() => {
                resetAssignForm();
                setShowAssign(true);
                void loadCustomers();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" /> Assign Membership
            </button>
          )}
          {tab === "categories" && (
            <button
              type="button"
              onClick={() => openCategoryForm(null)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" /> Add Category
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("memberships")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "memberships"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Purchased Memberships
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab("categories")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "categories"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <BadgeCheck className="h-4 w-4" /> Categories
          </span>
        </button>
      </div>

      {/* Purchased Memberships */}
      {tab === "memberships" && (
        <div className="bg-card border border-border rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Customer</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Category</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Start</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">End</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Services</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Used</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Remaining</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Friend/Family Name &amp; Phone</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Invoice</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0 hover:bg-accent/50">
                  <td className="py-3 px-4">
                    <p className="text-foreground font-medium">{m.customerName || "—"}</p>
                    {m.customerPhone && (
                      <p className="text-xs text-muted-foreground">{m.customerPhone}</p>
                    )}
                    <span className={`inline-flex mt-1 px-2 py-0.5 rounded text-xs font-medium capitalize ${statusClass(m.status)}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-foreground">{m.categoryName || "—"}</td>
                  <td className="py-3 px-4 text-muted-foreground">{m.startDate || "—"}</td>
                  <td className="py-3 px-4 text-muted-foreground">{m.endDate || "—"}</td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{servicesSummaryText(m)}</td>
                  <td className="py-3 px-4 text-muted-foreground">{usedTotalText(m)}</td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{remainingText(m)}</td>
                  <td className="py-3 px-4 text-muted-foreground text-xs max-w-[200px]">
                    <span className="inline-flex items-start gap-1">
                      <Users className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{friendsDisplayText(m)}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground font-mono text-xs">{m.invoiceNumber || "—"}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => void openDetail(m.id)}
                        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void printMembershipInvoice(m)}
                        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        title="Print invoice"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(m)}
                        disabled={m.status === "cancelled"}
                        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openFriendForm(m.id)}
                        disabled={m.status === "cancelled"}
                        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                        title="Add friend"
                      >
                        <UserPlus className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCancel(m)}
                        disabled={m.status === "cancelled"}
                        className="p-1.5 rounded hover:bg-destructive/20 text-destructive transition-colors disabled:opacity-40"
                        title="Cancel"
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {memberships.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    No memberships yet — assign one to get started
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Categories */}
      {tab === "categories" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="bg-card border border-border rounded-lg p-5 hover:border-primary transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                    <BadgeCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-base font-heading font-semibold text-card-foreground">{cat.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {cat.durationMonths} months · {cat.discountPercent}% off
                      {!cat.active && " · Inactive"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openCategoryForm(cat)}
                  className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <p className="text-lg font-heading font-bold text-primary">Rs. {cat.price.toLocaleString()}</p>
                {cat.priceBeforeDiscount > cat.price && (
                  <p className="text-xs text-muted-foreground line-through">
                    Rs. {cat.priceBeforeDiscount.toLocaleString()}
                  </p>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {cat.services
                  .filter((s) => s.quantity !== null && s.quantity !== undefined)
                  .map((s, i) => (
                    <span key={s.id ?? i} className="px-2 py-0.5 bg-secondary text-secondary-foreground text-xs rounded">
                      {s.serviceName}
                      {Number(s.quantity) === 0 ? " ∞" : ` ×${s.quantity}`}
                      {s.shareable === false ? " · holder" : " · share"}
                    </span>
                  ))}
                {cat.services.filter((s) => s.quantity !== null && s.quantity !== undefined).length === 0 && (
                  <span className="text-xs text-muted-foreground">No services configured</span>
                )}
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground bg-card border border-border rounded-lg">
              No categories yet — add Star, Premium, Royal, etc.
            </div>
          )}
        </div>
      )}

      {/* Assign Membership Modal */}
      {showAssign && (
        <div
          className="fixed inset-0 bg-foreground/20 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowAssign(false);
            resetAssignForm();
          }}
        >
          <div
            className="bg-card border border-border rounded-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-semibold text-card-foreground">Assign Membership</h2>
              <button
                type="button"
                onClick={() => {
                  setShowAssign(false);
                  resetAssignForm();
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAssign} className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="assign-customer-search" className="text-sm text-muted-foreground">
                  Customer <span className="text-destructive">*</span>
                </label>
                <input
                  id="assign-customer-search"
                  type="text"
                  placeholder="Search by name or phone..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <select
                  id="assign-customerId"
                  name="customerId"
                  required
                  value={assignCustomerId}
                  onChange={(e) => setAssignCustomerId(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select customer</option>
                  {filteredCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.phone}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="assign-categoryId" className="text-sm text-muted-foreground">
                  Category <span className="text-destructive">*</span>
                </label>
                <select
                  id="assign-categoryId"
                  name="categoryId"
                  required
                  value={assignCategoryId}
                  onChange={(e) => applyCategoryDefaults(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select category</option>
                  {categories.filter((c) => c.active).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — Rs. {c.price.toLocaleString()} ({c.durationMonths} mo)
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="assign-startDate" className="text-sm text-muted-foreground">
                    Start date <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="assign-startDate"
                    name="startDate"
                    type="date"
                    required
                    value={assignStartDate}
                    onChange={(e) => {
                      const start = e.target.value;
                      setAssignStartDate(start);
                      if (assignCategoryId) applyCategoryDefaults(assignCategoryId, start);
                    }}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="assign-endDate" className="text-sm text-muted-foreground">
                    End date
                  </label>
                  <input
                    id="assign-endDate"
                    name="endDate"
                    type="date"
                    required
                    value={assignEndDate}
                    onChange={(e) => setAssignEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Payment status</label>
                  <input type="hidden" name="paymentStatus" value="paid" />
                  <div className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-md text-sm text-foreground">
                    Paid
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="assign-paymentMethod" className="text-sm text-muted-foreground">
                    Payment type
                  </label>
                  <select
                    id="assign-paymentMethod"
                    value={assignPaymentMethod}
                    onChange={(e) =>
                      setAssignPaymentMethod(e.target.value as "cash" | "card" | "online")
                    }
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="online">Online</option>
                  </select>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label htmlFor="assign-paidAmount" className="text-sm text-muted-foreground">
                    Amount (category price)
                  </label>
                  <input
                    id="assign-paidAmount"
                    name="paidAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={assignPaidAmount}
                    onChange={(e) => setAssignPaidAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
              {assignCategoryId && (
                <p className="text-xs text-muted-foreground">
                  Auto-filled from category: start = today, end = duration, payment = Paid, amount = membership price.
                </p>
              )}
              <button
                type="submit"
                disabled={loading || !assignCustomerId || !assignCategoryId}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Assign &amp; Generate Invoice
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Category Form Modal */}
      {showCategoryForm && (
        <div
          className="fixed inset-0 bg-foreground/20 z-50 flex items-center justify-center p-4"
          onClick={() => setShowCategoryForm(false)}
        >
          <div
            className="bg-card border border-border rounded-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-semibold text-card-foreground">
                {editingCategory ? "Edit" : "New"} Category
              </h2>
              <button type="button" onClick={() => setShowCategoryForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveCategory} className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="cat-name" className="text-sm text-muted-foreground">
                  Name <span className="text-destructive">*</span>
                </label>
                <input
                  id="cat-name"
                  name="name"
                  required
                  defaultValue={editingCategory?.name}
                  placeholder="e.g. Premium"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="cat-durationMonths" className="text-sm text-muted-foreground">
                    Duration (months)
                  </label>
                  <input
                    id="cat-durationMonths"
                    name="durationMonths"
                    type="number"
                    min="1"
                    defaultValue={editingCategory?.durationMonths ?? 3}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="cat-discountPercent" className="text-sm text-muted-foreground">
                    Discount %
                  </label>
                  <input
                    id="cat-discountPercent"
                    name="discountPercent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    defaultValue={editingCategory?.discountPercent ?? 0}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="cat-price" className="text-sm text-muted-foreground">
                    Price <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="cat-price"
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    defaultValue={editingCategory?.price ?? 0}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="cat-priceBeforeDiscount" className="text-sm text-muted-foreground">
                    Price before discount
                  </label>
                  <input
                    id="cat-priceBeforeDiscount"
                    name="priceBeforeDiscount"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={editingCategory?.priceBeforeDiscount ?? 0}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    name="active"
                    type="checkbox"
                    defaultChecked={editingCategory?.active ?? true}
                    className="rounded border-border"
                  />
                  Active
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-sm text-muted-foreground">
                    Services{" "}
                    <span className="text-xs">(select service · qty · shareable per row)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setCategoryServiceRows((rows) => [...rows, emptyServiceRow()])}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add row
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Qty: <span className="text-foreground">∞ Infinity</span> = membership holder unlimited use.
                  Friends only if Share is on (and for ∞ they still pay). Blank = not included. Number = limited pool.
                </p>
                <input
                  type="text"
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  placeholder="Search services..."
                  className="w-full px-2 py-1.5 bg-background border border-border rounded-md text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <div className="space-y-2 max-h-56 overflow-y-auto border border-border rounded-md p-2 bg-background">
                  {categoryServiceRows.map((row, idx) => {
                    const q = serviceSearch.trim().toLowerCase();
                    const options = catalogServices.filter((s) => {
                      if (row.serviceId && s.id === row.serviceId) return true;
                      if (!q) return true;
                      return s.name.toLowerCase().includes(q);
                    });
                    const qtyMode =
                      row.quantity === "" ? "blank" : row.quantity === "0" ? "infinity" : "limited";
                    return (
                      <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                        <select
                          value={row.serviceId}
                          onChange={(e) => applyServiceToRow(idx, e.target.value)}
                          className="col-span-5 px-2 py-1.5 bg-card border border-border rounded-md text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="">Select service...</option>
                          {options.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} — Rs. {s.price}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          placeholder="Price"
                          min="0"
                          step="0.01"
                          value={row.servicePrice}
                          readOnly
                          title="Auto-filled from selected service"
                          className="col-span-2 px-2 py-1.5 bg-secondary/40 border border-border rounded-md text-xs text-muted-foreground"
                        />
                        <div className="col-span-2 flex flex-col gap-0.5 min-w-0">
                          <select
                            value={qtyMode}
                            onChange={(e) => {
                              const mode = e.target.value;
                              const next = [...categoryServiceRows];
                              if (mode === "blank") {
                                next[idx] = { ...next[idx], quantity: "" };
                              } else if (mode === "infinity") {
                                next[idx] = { ...next[idx], quantity: "0" };
                              } else {
                                const current = Number(next[idx].quantity);
                                next[idx] = {
                                  ...next[idx],
                                  quantity: !current || current <= 0 ? "1" : String(current),
                                };
                              }
                              setCategoryServiceRows(next);
                            }}
                            title="Quantity type"
                            className="w-full px-1 py-1.5 bg-card border border-border rounded-md text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            <option value="blank">—</option>
                            <option value="infinity">∞ Infinity</option>
                            <option value="limited">Limited</option>
                          </select>
                          {qtyMode === "limited" && (
                            <input
                              type="number"
                              placeholder="Qty"
                              min="1"
                              step="1"
                              value={row.quantity}
                              onChange={(e) => {
                                const next = [...categoryServiceRows];
                                const v = e.target.value;
                                next[idx] = {
                                  ...next[idx],
                                  quantity: v === "" || Number(v) < 1 ? "1" : v,
                                };
                                setCategoryServiceRows(next);
                              }}
                              className="w-full px-1 py-1 bg-card border border-border rounded-md text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                          )}
                        </div>
                        <label
                          className="col-span-2 flex items-center justify-center gap-1 text-[11px] text-foreground"
                          title="Friends/Family can redeem this service"
                        >
                          <input
                            type="checkbox"
                            checked={row.shareable}
                            onChange={(e) => {
                              const next = [...categoryServiceRows];
                              next[idx] = { ...next[idx], shareable: e.target.checked };
                              setCategoryServiceRows(next);
                            }}
                            className="rounded border-border"
                          />
                          Share
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setCategoryServiceRows((rows) =>
                              rows.length <= 1 ? [emptyServiceRow()] : rows.filter((_, i) => i !== idx)
                            )
                          }
                          className="col-span-1 p-1 text-muted-foreground hover:text-destructive"
                          title="Remove"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {editingCategory ? "Update" : "Create"} Category
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {(detail || detailLoading) && (
        <div
          className="fixed inset-0 bg-foreground/20 z-50 flex items-center justify-center p-4"
          onClick={() => !detailLoading && setDetail(null)}
        >
          <div
            className="bg-card border border-border rounded-lg w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading && !detail ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Loading details...</p>
            ) : detail ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-heading font-semibold text-card-foreground">
                      {detail.customerName}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {detail.categoryName} · {detail.startDate} — {detail.endDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void printMembershipInvoice(detail)}
                      className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      title="Print invoice"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                    {detail.status !== "cancelled" && (
                      <button
                        type="button"
                        onClick={() => openEdit(detail)}
                        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    <button type="button" onClick={() => setDetail(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 mb-4 text-sm">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium capitalize ${statusClass(detail.status)}`}>
                    {detail.status}
                  </span>
                  <span className="text-muted-foreground">
                    Invoice: <span className="font-mono text-foreground">{detail.invoiceNumber || "—"}</span>
                  </span>
                  <span className="text-muted-foreground capitalize">
                    Payment: {detail.paymentStatus} · Rs. {Number(detail.paidAmount).toLocaleString()}
                    {" / "}Rs. {Number(detail.price).toLocaleString()}
                  </span>
                  {detail.customerPhone && (
                    <span className="text-muted-foreground">{detail.customerPhone}</span>
                  )}
                </div>

                <h3 className="text-sm font-heading font-semibold text-card-foreground mb-2">Service usage</h3>
                <div className="bg-background border border-border rounded-lg overflow-hidden mb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Service</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Allowed</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Used</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Remaining</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Shareable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.services ?? []).map((svc) => (
                        <tr key={svc.id || svc.serviceName} className="border-b border-border last:border-0">
                          <td className="py-2 px-3 text-foreground">{svc.serviceName}</td>
                          <td className="py-2 px-3 text-muted-foreground">{formatAllowed(svc.allowedQty)}</td>
                          <td className="py-2 px-3 text-muted-foreground">
                            {svc.allowedQty === null || svc.allowedQty === undefined ? "—" : svc.usedQty}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">
                            {formatRemaining(svc.allowedQty, svc.usedQty)}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">
                            {svc.shareable === false ? "No (holder only)" : "Yes"}
                          </td>
                        </tr>
                      ))}
                      {(detail.services ?? []).length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-muted-foreground">
                            No services on this membership
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-heading font-semibold text-card-foreground">
                    Friends ({detail.friends?.length ?? 0})
                  </h3>
                  {detail.status !== "cancelled" && (
                    <button
                      type="button"
                      onClick={() => openFriendForm(detail.id)}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <UserPlus className="h-3.5 w-3.5" /> Add friend
                    </button>
                  )}
                </div>
                <div className="space-y-2 mb-4">
                  {(detail.friends ?? []).map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between px-3 py-2 bg-background border border-border rounded-md text-sm"
                    >
                      <div>
                        <p className="text-foreground font-medium">{f.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[f.phone, f.relationship].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                  {(detail.friends ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">No friends added yet</p>
                  )}
                </div>

                <h3 className="text-sm font-heading font-semibold text-card-foreground mb-2">Usage history</h3>
                <div className="bg-background border border-border rounded-lg overflow-hidden mb-4 overflow-x-auto">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Date</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Service</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Used by</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Status</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Amount</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.usage ?? []).map((u) => (
                        <tr key={u.id} className="border-b border-border last:border-0">
                          <td className="py-2 px-3 text-muted-foreground">{u.usageDate || "—"}</td>
                          <td className="py-2 px-3 text-foreground">{u.serviceName || "—"}</td>
                          <td className="py-2 px-3 text-muted-foreground">{usageUsedByLabel(u)}</td>
                          <td className="py-2 px-3 text-muted-foreground capitalize">{u.status || "—"}</td>
                          <td className="py-2 px-3 text-muted-foreground">
                            Rs. {Number(u.amountCharged || 0).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">{u.quantity}</td>
                        </tr>
                      ))}
                      {(detail.usage ?? []).length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-muted-foreground">
                            No usage recorded yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => void printMembershipInvoice(detail)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    <Printer className="h-4 w-4" /> Print Invoice
                  </button>
                  {detail.status !== "cancelled" && (
                    <button
                      type="button"
                      onClick={() => void handleCancel(detail)}
                      className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      Cancel Membership
                    </button>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Edit Membership Modal */}
      {showEdit && editingMembership && (
        <div
          className="fixed inset-0 bg-foreground/20 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowEdit(false);
            setEditingMembership(null);
          }}
        >
          <div
            className="bg-card border border-border rounded-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-semibold text-card-foreground">Edit Membership</h2>
              <button
                type="button"
                onClick={() => {
                  setShowEdit(false);
                  setEditingMembership(null);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {editingMembership.customerName} · {editingMembership.categoryName}
            </p>
            <form onSubmit={handleEditMembership} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="edit-startDate" className="text-sm text-muted-foreground">
                    Start date
                  </label>
                  <input
                    id="edit-startDate"
                    name="startDate"
                    type="date"
                    required
                    defaultValue={editingMembership.startDate}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="edit-endDate" className="text-sm text-muted-foreground">
                    End date
                  </label>
                  <input
                    id="edit-endDate"
                    name="endDate"
                    type="date"
                    required
                    defaultValue={editingMembership.endDate}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Payment status</label>
                  <input type="hidden" name="paymentStatus" value="paid" />
                  <div className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-md text-sm text-foreground">
                    Paid
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="edit-paidAmount" className="text-sm text-muted-foreground">
                    Paid amount
                  </label>
                  <input
                    id="edit-paidAmount"
                    name="paidAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={editingMembership.paidAmount}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="edit-status" className="text-sm text-muted-foreground">
                  Status
                </label>
                <select
                  id="edit-status"
                  name="status"
                  defaultValue={editingMembership.status}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="active">Active</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="expired">Expired</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="edit-notes" className="text-sm text-muted-foreground">
                  Notes
                </label>
                <textarea
                  id="edit-notes"
                  name="notes"
                  rows={3}
                  defaultValue={editingMembership.notes ?? ""}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Friend Modal */}
      {showFriendForm && friendMembershipId && (
        <div
          className="fixed inset-0 bg-foreground/20 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowFriendForm(false);
            setFriendMembershipId(null);
          }}
        >
          <div
            className="bg-card border border-border rounded-lg w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-semibold text-card-foreground">Add Friend</h2>
              <button
                type="button"
                onClick={() => {
                  setShowFriendForm(false);
                  setFriendMembershipId(null);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddFriend} className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="friend-name" className="text-sm text-muted-foreground">
                  Name <span className="text-destructive">*</span>
                </label>
                <input
                  id="friend-name"
                  name="name"
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="friend-phone" className="text-sm text-muted-foreground">
                  Phone
                </label>
                <input
                  id="friend-phone"
                  name="phone"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="friend-relationship" className="text-sm text-muted-foreground">
                  Relationship
                </label>
                <input
                  id="friend-relationship"
                  name="relationship"
                  placeholder="e.g. spouse, sister"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Add Friend
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Memberships;
