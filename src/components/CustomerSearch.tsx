import { useState, useRef, useEffect } from "react";
import { Search, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Customer } from "@/types/pos";

const CUSTOMERS_API_BASE = "https://mediumorchid-emu-182487.hostingersite.com/customers.php";

interface CustomerSearchProps {
  selectedCustomerId: string | null;
  onSelect: (id: string | null) => void;
}

export function CustomerSearch({ selectedCustomerId, onSelect }: CustomerSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(CUSTOMERS_API_BASE)
      .then((res) => res.ok ? res.json() : [])
      .then((raw: any[]) => {
        if (cancelled) return;
        setCustomers((raw || []).map((row: any) => ({
          id: String(row.id),
          name: String(row.name),
          phone: String(row.phone || ""),
          email: String(row.email || ""),
          notes: String(row.notes || ""),
          preferences: String(row.preferences || ""),
          lastVisit: String(row.last_visit || row.lastVisit || ""),
          visitCount: Number(row.visit_count ?? row.visitCount ?? 0),
        })));
      })
      .catch(() => { if (!cancelled) setCustomers([]); });
    return () => { cancelled = true; };
  }, []);

  const selected = customers.find((c) => c.id === selectedCustomerId);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.phone.includes(query) ||
      c.email.toLowerCase().includes(query.toLowerCase())
  );

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 cursor-pointer bg-secondary text-secondary-foreground text-sm rounded-md px-3 py-1.5 border border-border hover:border-ring transition-colors min-w-[200px]"
      >
        <User className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="truncate flex-1">{selected ? selected.name : "Walk-in Customer"}</span>
        {selected && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(null);
            }}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-72 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                autoFocus
                type="text"
                placeholder="Search by name, phone, email..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-background text-foreground text-sm rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Walk-in option */}
          <button
            onClick={() => { onSelect(null); setOpen(false); setQuery(""); }}
            className={cn(
              "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2",
              !selectedCustomerId && "bg-accent"
            )}
          >
            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-foreground font-medium">Walk-in Customer</span>
          </button>

          {/* Customer list */}
          <div className="max-h-48 overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => { onSelect(c.id); setOpen(false); setQuery(""); }}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2",
                  selectedCustomerId === c.id && "bg-accent"
                )}
              >
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">{c.name.split(" ").map(n => n[0]).join("")}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.phone}</p>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No customers found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
