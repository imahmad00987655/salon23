import { useEffect, useState } from "react";
import { Discount } from "@/types/pos";
import { Plus, X, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { DEFAULT_DISCOUNTS, DISCOUNTS_STORAGE_KEY } from "@/lib/discounts";
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from "@/lib/appSettings";

const DISCOUNTS_API_BASE = "http://localhost/salon-spark-main/api/discounts.php";

const Discounts = () => {
  const [discountList, setDiscountList] = useLocalStorageState<Discount[]>(DISCOUNTS_STORAGE_KEY, DEFAULT_DISCOUNTS);
  const [settings, setSettings] = useLocalStorageState(SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Discount | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDiscounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(DISCOUNTS_API_BASE);
      if (!res.ok) throw new Error("Failed to load discounts");
      const data = (await res.json()) as Discount[];
      setDiscountList(data);
    } catch (e) {
      // fall back to localStorage state if API fails
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDiscounts();
  }, []);

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name") as string,
      type: fd.get("type") as "percentage" | "fixed",
      value: Number(fd.get("value")),
      maxCap: fd.get("maxCap") ? Number(fd.get("maxCap")) : undefined,
      reason: fd.get("reason") as string,
    };

    const submit = async () => {
      try {
        setLoading(true);
        setError(null);
        const isEdit = Boolean(editing);
        const url = isEdit ? `${DISCOUNTS_API_BASE}?id=${editing!.id}` : DISCOUNTS_API_BASE;
        const res = await fetch(url, {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to save discount");
        }
        await loadDiscounts();
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
    const ok = window.confirm(`Delete discount "${editing.name}"? This cannot be undone.`);
    if (!ok) return;

    const submit = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${DISCOUNTS_API_BASE}?id=${editing.id}`, { method: "DELETE" });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to delete discount");
        }
        await loadDiscounts();
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
          <h1 className="text-2xl font-heading font-bold text-foreground">Discounts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? "Loading..." : "Manage discount rules"}
          </p>
          {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus className="h-4 w-4" /> Add Discount
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {discountList.map((d) => (
          <div key={d.id} onClick={() => { setEditing(d); setShowForm(true); }} className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:border-primary transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center text-primary"><Percent className="h-5 w-5" /></div>
              <div>
                <p className="text-sm font-medium text-card-foreground">{d.name}</p>
                <p className="text-xs text-muted-foreground">{d.reason}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className={cn("px-2 py-0.5 rounded text-xs font-medium", d.type === "percentage" ? "bg-primary/10 text-primary" : "bg-success/10 text-success")}>
                {d.type === "percentage" ? `${d.value}%` : `Rs. ${d.value}`} off
              </span>
              <span className="text-xs text-muted-foreground">{d.usageCount} uses</span>
            </div>
            {d.maxCap && <p className="mt-2 text-xs text-muted-foreground">Max cap: Rs. {d.maxCap}</p>}
          </div>
        ))}
      </div>

      {/* Tax & Billing — used by POS */}
      <section className="bg-card border border-border rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-heading font-semibold text-card-foreground">Tax & Billing</h2>
        <div className="space-y-1.5">
          <label htmlFor="discounts-taxRate" className="text-xs text-muted-foreground">
            Tax Rate (%)
          </label>
          <input
            id="discounts-taxRate"
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={Number.isFinite(settings.taxRate) ? settings.taxRate * 100 : 0}
            onChange={(e) => {
              const pct = Number(e.target.value);
              const next = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) / 100 : 0;
              setSettings((prev) => ({ ...prev, taxRate: next }));
            }}
            className="w-full max-w-xs px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">Applies automatically in POS billing.</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="discounts-invoicePrefix" className="text-xs text-muted-foreground">
            Invoice Prefix
          </label>
          <input
            id="discounts-invoicePrefix"
            value={settings.invoicePrefix}
            onChange={(e) => setSettings((prev) => ({ ...prev, invoicePrefix: e.target.value }))}
            className="w-full max-w-xs px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="SALON-"
          />
        </div>
      </section>

      {showForm && (
        <div className="fixed inset-0 bg-foreground/20 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-card border border-border rounded-lg w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-semibold text-card-foreground">{editing ? "Edit" : "New"} Discount</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="discount-name" className="text-sm text-muted-foreground">
                  Discount name <span className="text-destructive">*</span>
                </label>
                <input
                  id="discount-name"
                  name="name"
                  defaultValue={editing?.name}
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="discount-type" className="text-sm text-muted-foreground">
                  Type <span className="text-destructive">*</span>
                </label>
                <select
                  id="discount-type"
                  name="type"
                  defaultValue={editing?.type || "percentage"}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="discount-value" className="text-sm text-muted-foreground">
                  Value {((editing?.type || "percentage") === "percentage") ? "(%)" : "(Rs.)"} <span className="text-destructive">*</span>
                </label>
                <input
                  id="discount-value"
                  name="value"
                  type="number"
                  defaultValue={editing?.value}
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="discount-maxCap" className="text-sm text-muted-foreground">
                  Max cap (optional)
                </label>
                <input
                  id="discount-maxCap"
                  name="maxCap"
                  type="number"
                  defaultValue={editing?.maxCap}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="discount-reason" className="text-sm text-muted-foreground">
                  Reason <span className="text-destructive">*</span>
                </label>
                <input
                  id="discount-reason"
                  name="reason"
                  defaultValue={editing?.reason}
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  {editing ? "Update" : "Create"} Discount
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

export default Discounts;
