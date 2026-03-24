import { useEffect, useState } from "react";
import { Customer } from "@/types/pos";
import { Search, Plus, Phone, Mail, Calendar, X } from "lucide-react";

const API_BASE = "https://saddlebrown-antelope-612005.hostingersite.com/customers.php";

const Customers = () => {
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(API_BASE);
      if (!res.ok) throw new Error("Failed to load customers");
      const raw = (await res.json()) as any[];
      const mapped: Customer[] = (raw || []).map((row: any) => ({
        id: String(row.id),
        name: String(row.name ?? ""),
        phone: String(row.phone ?? ""),
        email: String(row.email ?? ""),
        notes: String(row.notes ?? ""),
        preferences: String(row.preferences ?? ""),
        lastVisit: String(row.last_visit ?? row.lastVisit ?? ""),
        visitCount: Number(row.visit_count ?? row.visitCount ?? 0),
        active: Boolean(row.active ?? 1),
      }));
      setCustomerList(mapped);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const filtered = customerList.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name") as string,
      phone: fd.get("phone") as string,
      email: (fd.get("email") as string) ?? "",
      notes: (fd.get("notes") as string) ?? "",
      preferences: (fd.get("preferences") as string) ?? "",
      active: fd.get("active") === "on",
    };

    const submit = async () => {
      try {
        setLoading(true);
        setError(null);
        const isEdit = Boolean(editingCustomer);
        const url = isEdit ? `${API_BASE}?id=${editingCustomer!.id}` : API_BASE;
        const res = await fetch(url, {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to save customer");
        }
        await loadCustomers();
        setShowForm(false);
        setEditingCustomer(null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };

    void submit();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Customers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? "Loading..." : `${customerList.length} total customers`}
          </p>
          {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        </div>
        <button
          onClick={() => { setEditingCustomer(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Add Customer
        </button>
      </div>

      <div className="relative max-w-md">
        <label htmlFor="customer-search" className="sr-only">
          Search customers
        </label>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          id="customer-search"
          type="text"
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-card text-foreground text-sm rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((c) => (
          <div
            key={c.id}
            onClick={() => { setEditingCustomer(c); setShowForm(true); }}
            className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:border-primary transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold">
                {c.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div>
                <p className="text-sm font-medium text-card-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.visitCount} visits</p>
              </div>
              <span className={`ml-auto px-2 py-0.5 rounded text-xs font-medium ${c.active ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                {c.active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" /> {c.phone}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" /> {c.email}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" /> Last visit: {c.lastVisit || "—"}
              </div>
            </div>
            {c.notes && (
              <p className="mt-2 text-xs text-muted-foreground bg-secondary rounded px-2 py-1">{c.notes}</p>
            )}
          </div>
        ))}
      </div>

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 bg-foreground/20 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-card border border-border rounded-lg w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-semibold text-card-foreground">
                {editingCustomer ? "Edit Customer" : "New Customer"}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="customer-name" className="text-sm text-muted-foreground">
                  Name <span className="text-destructive">*</span>
                </label>
                <input
                  id="customer-name"
                  name="name"
                  defaultValue={editingCustomer?.name}
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="customer-phone" className="text-sm text-muted-foreground">
                  Phone <span className="text-destructive">*</span>
                </label>
                <input
                  id="customer-phone"
                  name="phone"
                  defaultValue={editingCustomer?.phone}
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="customer-email" className="text-sm text-muted-foreground">
                  Email
                </label>
                <input
                  id="customer-email"
                  name="email"
                  type="email"
                  defaultValue={editingCustomer?.email}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="customer-preferences" className="text-sm text-muted-foreground">
                  Preferences
                </label>
                <input
                  id="customer-preferences"
                  name="preferences"
                  defaultValue={editingCustomer?.preferences}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="customer-notes" className="text-sm text-muted-foreground">
                  Notes
                </label>
                <textarea
                  id="customer-notes"
                  name="notes"
                  defaultValue={editingCustomer?.notes}
                  rows={3}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>
              <label htmlFor="customer-active" className="flex items-center gap-2 text-sm text-foreground">
                <input
                  id="customer-active"
                  name="active"
                  type="checkbox"
                  defaultChecked={editingCustomer?.active ?? true}
                  className="rounded border-border"
                />
                Active customer
              </label>
              <button type="submit" className="w-full py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
                {editingCustomer ? "Update" : "Create"} Customer
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
