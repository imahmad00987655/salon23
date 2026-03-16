import { useEffect, useState } from "react";
import { Package, Service } from "@/types/pos";
import { Plus, X, Gift } from "lucide-react";

const PACKAGES_API_BASE = "http://localhost/salon-spark-main/api/packages.php";
const SERVICES_API_BASE = "http://localhost/salon-spark-main/api/services.php";

const Packages = () => {
  const [packageList, setPackageList] = useState<Package[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Package | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadServices = async () => {
    try {
      const res = await fetch(SERVICES_API_BASE);
      if (!res.ok) return;
      const raw = (await res.json()) as any[];
      setServices(raw.map((row) => ({
        id: `s${row.id}`,
        name: String(row.name),
        categoryId: `cat-${row.category_id}`,
        price: Number(row.price),
        duration: Number(row.duration),
        active: Boolean(row.active),
      })));
    } catch {
      setServices([]);
    }
  };

  const loadPackages = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(PACKAGES_API_BASE);
      if (!res.ok) throw new Error("Failed to load packages");
      const raw = (await res.json()) as any[];
      const mapped: Package[] = raw.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        // Backend returns numeric service IDs; map them to sampleData-style IDs ("s1", "s2", ...)
        serviceIds: (row.serviceIds ?? []).map((sid: number | string) => `s${Number(sid)}`),
        discountedPrice: Number(row.discounted_price ?? row.discountedPrice ?? 0),
        startDate: String(row.start_date ?? row.startDate ?? ""),
        endDate: String(row.end_date ?? row.endDate ?? ""),
        usageCount: Number(row.usage_count ?? row.usageCount ?? 0),
        revenue: Number(row.revenue ?? 0),
      }));
      setPackageList(mapped);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
    loadServices();
  }, []);

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const selectedServices = fd.getAll("services") as string[];
    const numericServiceIds = selectedServices
      .map((id) => Number(String(id).replace(/^s/, "")))
      .filter((n) => n > 0);
    const payload = {
      name: fd.get("name") as string,
      // Send numeric IDs to the PHP API
      serviceIds: numericServiceIds,
      discountedPrice: Number(fd.get("discountedPrice")),
      startDate: fd.get("startDate") as string,
      endDate: fd.get("endDate") as string,
    };

    const submit = async () => {
      try {
        setLoading(true);
        setError(null);
        const isEdit = Boolean(editing);
        const url = isEdit ? `${PACKAGES_API_BASE}?id=${editing!.id}` : PACKAGES_API_BASE;
        const res = await fetch(url, {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to save package");
        }
        await loadPackages();
        setShowForm(false);
        setEditing(null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };

    void submit();
  };

  const handleDelete = () => {
    if (!editing) return;
    const ok = window.confirm(`Delete package "${editing.name}"? This cannot be undone.`);
    if (!ok) return;

    const submit = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${PACKAGES_API_BASE}?id=${editing.id}`, { method: "DELETE" });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to delete package");
        }
        await loadPackages();
        setShowForm(false);
        setEditing(null);
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
          <h1 className="text-2xl font-heading font-bold text-foreground">Packages</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? "Loading..." : "Bundled service offerings"}
          </p>
          {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus className="h-4 w-4" /> Create Package
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {packageList.map((pkg) => {
          const includedServices = services.filter((s) => pkg.serviceIds.includes(s.id));
          const originalPrice = includedServices.reduce((sum, s) => sum + s.price, 0);
          return (
            <div key={pkg.id} onClick={() => { setEditing(pkg); setShowForm(true); }} className="bg-card border border-border rounded-lg p-5 cursor-pointer hover:border-primary transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center text-primary"><Gift className="h-5 w-5" /></div>
                  <div>
                    <p className="text-base font-heading font-semibold text-card-foreground">{pkg.name}</p>
                    <p className="text-xs text-muted-foreground">{pkg.startDate} — {pkg.endDate}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-heading font-bold text-primary">Rs. {pkg.discountedPrice}</p>
                  <p className="text-xs text-muted-foreground line-through">Rs. {originalPrice}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {includedServices.map((s) => (
                  <span key={s.id} className="px-2 py-0.5 bg-secondary text-secondary-foreground text-xs rounded">{s.name}</span>
                ))}
              </div>
              <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                <span>{pkg.usageCount} used</span>
                <span>Rs. {pkg.revenue.toLocaleString()} revenue</span>
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-foreground/20 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-card border border-border rounded-lg w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-semibold text-card-foreground">{editing ? "Edit" : "New"} Package</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="package-name" className="text-sm text-muted-foreground">
                  Package name <span className="text-destructive">*</span>
                </label>
                <input
                  id="package-name"
                  name="name"
                  defaultValue={editing?.name}
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">
                  Select services <span className="text-destructive">*</span>
                </label>
                <div className="mb-2">
                  <input
                    type="text"
                    placeholder="Search services..."
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    className="w-full px-2 py-1.5 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto border border-border rounded-md p-2 bg-background">
                  {services
                    .filter((s) =>
                      s.name.toLowerCase().includes(serviceSearch.toLowerCase())
                    )
                    .map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        id={`package-service-${s.id}`}
                        name="services"
                        type="checkbox"
                        value={s.id}
                        defaultChecked={editing?.serviceIds.includes(s.id)}
                        className="rounded border-border"
                      />
                      <span className="truncate">{s.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">Rs. {s.price}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="package-discountedPrice" className="text-sm text-muted-foreground">
                  Package price <span className="text-destructive">*</span>
                </label>
                <input
                  id="package-discountedPrice"
                  name="discountedPrice"
                  type="number"
                  defaultValue={editing?.discountedPrice}
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="package-startDate" className="text-sm text-muted-foreground">
                    Start date <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="package-startDate"
                    name="startDate"
                    type="date"
                    defaultValue={editing?.startDate}
                    required
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="package-endDate" className="text-sm text-muted-foreground">
                    End date <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="package-endDate"
                    name="endDate"
                    type="date"
                    defaultValue={editing?.endDate}
                    required
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  {editing ? "Update" : "Create"} Package
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={!editing}
                  className="w-full py-2.5 bg-destructive text-destructive-foreground rounded-md text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                >
                  Delete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Packages;
