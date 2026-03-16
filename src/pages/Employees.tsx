import { useMemo, useState, useEffect } from "react";
import { Employee, Transaction } from "@/types/pos";
import { Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const EMPLOYEES_API_BASE = "http://localhost/salon-spark-main/api/employees.php";
const TRANSACTIONS_API_BASE = "http://localhost/salon-spark-main/api/transactions.php";

const Employees = () => {
  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [roleOptions, setRoleOptions] = useState<string[]>([
    "stylist",
    "nail_tech",
    "esthetician",
    "makeup_artist",
  ]);
  const [selectedRole, setSelectedRole] = useState<string>("stylist");
  const [showNewRole, setShowNewRole] = useState(false);
  const [newRole, setNewRole] = useState("");

  const loadTransactions = async () => {
    try {
      const res = await fetch(TRANSACTIONS_API_BASE);
      if (!res.ok) return;
      const raw = (await res.json()) as any[];
      setTransactions((raw || []).map((t: any) => ({
        ...t,
        date: t.date || t.transaction_date || "",
        items: t.items || [],
      })));
    } catch {
      setTransactions([]);
    }
  };

  const loadEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(EMPLOYEES_API_BASE);
      if (!res.ok) throw new Error("Failed to load employees");
      const raw = (await res.json()) as any[];
      const mapped: Employee[] = raw.map((row) => ({
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
      setEmployeeList(mapped);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEmployees();
    void loadTransactions();
  }, []);

  useEffect(() => {
    if (!employeeList.length) return;
    setRoleOptions((prev) => {
      const all = new Set(prev);
      employeeList.forEach((e) => {
        if (e.role) all.add(e.role);
      });
      return Array.from(all);
    });
  }, [employeeList]);

  useEffect(() => {
    setSelectedRole(editing?.role || roleOptions[0] || "stylist");
  }, [editing, roleOptions]);

  const employeesWithActivityByDate = useMemo(() => {
    if (!fromDate && !toDate) return null;
    const activeIds = new Set<string>();
    transactions.forEach((t) => {
      if (fromDate && t.date < fromDate) return;
      if (toDate && t.date > toDate) return;
      (t.items ?? []).forEach((item: { employeeId?: string }) => activeIds.add(item.employeeId || ""));
    });
    return activeIds;
  }, [fromDate, toDate, transactions]);

  const filtered = employeeList.filter((e) => {
    const matchesName = e.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesName) return false;
    if (!employeesWithActivityByDate) return true;
    return employeesWithActivityByDate.has(e.id);
  });

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name") as string,
      role: selectedRole,
      phone: fd.get("phone") as string,
      commissionRate: Number(fd.get("commissionRate")),
      active: fd.get("active") === "on",
    };

    const submit = async () => {
      try {
        setLoading(true);
        setError(null);
        const isEdit = Boolean(editing);
        const url = isEdit ? `${EMPLOYEES_API_BASE}?id=${editing!.id}` : EMPLOYEES_API_BASE;
        const res = await fetch(url, {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to save employee");
        }
        await loadEmployees();
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
    if (user?.role !== "super_admin") return;
    const ok = window.confirm(`Delete employee "${editing.name}"? This cannot be undone.`);
    if (!ok) return;

    const submit = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${EMPLOYEES_API_BASE}?id=${editing.id}`, { method: "DELETE" });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to delete employee");
        }
        await loadEmployees();
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
          <h1 className="text-2xl font-heading font-bold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? "Loading..." : `${employeeList.length} team members`}
          </p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus className="h-4 w-4" /> Add Employee
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-md w-full">
          <label htmlFor="employee-search" className="sr-only">
            Search employees
          </label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input id="employee-search" type="text" placeholder="Search employees..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-card text-foreground text-sm rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground" />
        </div>

        <div className="flex flex-wrap gap-2 text-xs md:text-sm">
          <div className="space-y-1">
            <label htmlFor="employee-from" className="text-muted-foreground">
              Active from
            </label>
            <input
              id="employee-from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-2 py-1.5 bg-card text-foreground rounded-md border border-border text-xs md:text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="employee-to" className="text-muted-foreground">
              Active to
            </label>
            <input
              id="employee-to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-2 py-1.5 bg-card text-foreground rounded-md border border-border text-xs md:text-sm"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((emp) => (
          <div key={emp.id} onClick={() => { setEditing(emp); setShowForm(true); }} className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:border-primary transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold">
                  {emp.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="text-sm font-medium text-card-foreground">{emp.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{emp.role.replace("_", " ")}</p>
                </div>
              </div>
              <span className={cn("px-2 py-0.5 rounded text-xs font-medium", emp.active ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                {emp.active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-heading font-bold text-foreground">{emp.servicesPerformed}</p>
                <p className="text-xs text-muted-foreground">Services</p>
              </div>
              <div>
                <p className="text-lg font-heading font-bold text-foreground">Rs. {emp.revenueGenerated.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Revenue</p>
              </div>
              <div>
                <p className="text-lg font-heading font-bold text-foreground">{emp.commissionRate}%</p>
                <p className="text-xs text-muted-foreground">Commission</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-foreground/20 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-card border border-border rounded-lg w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-semibold text-card-foreground">{editing ? "Edit" : "New"} Employee</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="employee-name" className="text-sm text-muted-foreground">
                  Full name <span className="text-destructive">*</span>
                </label>
                <input
                  id="employee-name"
                  name="name"
                  defaultValue={editing?.name}
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="employee-role" className="text-sm text-muted-foreground">
                  Role <span className="text-destructive">*</span>
                </label>
                <select
                  id="employee-role"
                  name="role"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role.replace("_", " ")}
                    </option>
                  ))}
                </select>
                {(user?.role === "super_admin" || user?.role === "manager") && (
                  <div className="pt-1">
                    {!showNewRole ? (
                      <button
                        type="button"
                        onClick={() => setShowNewRole(true)}
                        className="text-xs text-primary hover:underline"
                      >
                        + Add new role
                      </button>
                    ) : (
                      <div className="mt-2 space-y-1.5 rounded-md border border-border bg-muted/40 p-2">
                        <input
                          type="text"
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value)}
                          placeholder="Enter role name (e.g. Senior Stylist)"
                          className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded text-foreground placeholder:text-muted-foreground"
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              const value = newRole.trim();
                              if (!value) return;
                              setRoleOptions((prev) =>
                                prev.includes(value) ? prev : [...prev, value]
                              );
                              setSelectedRole(value);
                              setNewRole("");
                              setShowNewRole(false);
                            }}
                            className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground"
                          >
                            Save role
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowNewRole(false);
                              setNewRole("");
                            }}
                            className="px-2 py-1 text-xs rounded bg-secondary text-secondary-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="employee-phone" className="text-sm text-muted-foreground">
                  Phone <span className="text-destructive">*</span>
                </label>
                <input
                  id="employee-phone"
                  name="phone"
                  defaultValue={editing?.phone}
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="employee-commissionRate" className="text-sm text-muted-foreground">
                  Commission (%) <span className="text-destructive">*</span>
                </label>
                <input
                  id="employee-commissionRate"
                  name="commissionRate"
                  type="number"
                  defaultValue={editing?.commissionRate || 10}
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <label htmlFor="employee-active" className="flex items-center gap-2 text-sm text-foreground">
                <input
                  id="employee-active"
                  name="active"
                  type="checkbox"
                  defaultChecked={editing?.active ?? true}
                  className="rounded border-border"
                />
                Active
              </label>

              <div className={cn("grid gap-2", editing && user?.role === "super_admin" ? "grid-cols-2" : "grid-cols-1")}>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  {editing ? "Update" : "Create"} Employee
                </button>
                {editing && user?.role === "super_admin" && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full py-2.5 bg-destructive text-destructive-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Delete
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;
