import { useEffect, useState } from "react";
import { Transaction } from "@/types/pos";
import { Search, FileText, Download, Eye, X, Printer, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { openPrintWindow, buildProfessionalInvoiceHtml, downloadCsv } from "@/lib/exporting";
import { useAuth } from "@/contexts/AuthContext";

const TRANSACTIONS_API_BASE = "http://localhost/salon-spark-main/api/transactions.php";

const Invoices = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Transaction | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Transaction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const isSuperAdmin = user?.role === "super_admin";

  useEffect(() => {
    loadTransactions();
  }, []);

  const filtered = transactions.filter((t) => {
    const q = search.toLowerCase();
    if (
      !t.invoiceNumber.toLowerCase().includes(q) &&
      !t.customerName.toLowerCase().includes(q)
    ) {
      return false;
    }
    if (fromDate && t.date < fromDate) return false;
    if (toDate && t.date > toDate) return false;
    return true;
  });

  const [page, setPage] = useState(1);
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const buildInvoiceHtml = (inv: Transaction) => {
    const items = inv.items ?? [];
    return buildProfessionalInvoiceHtml({
      invoiceNumber: inv.invoiceNumber,
      date: inv.date,
      customerName: inv.customerName,
      paymentMethod: inv.paymentMethod,
      cashierName: user?.name ?? undefined,
      items: items.map((it) => ({
        serviceName: it.serviceName,
        employeeName: it.employeeName,
        quantity: it.quantity,
        price: it.price,
        total: it.price * it.quantity,
      })),
      subtotal: Number(inv.subtotal ?? 0),
      discount: Number(inv.discount ?? 0),
      tax: Number(inv.tax ?? 0),
      total: Number(inv.total ?? 0),
    });
  };

  const loadTransactions = async () => {
    try {
      const res = await fetch(TRANSACTIONS_API_BASE);
      if (!res.ok) return;
      const data = (await res.json()) as Transaction[];
      setTransactions(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    }
  };

  const handleDeleteInvoice = async (tx: Transaction) => {
    if (!isSuperAdmin || !window.confirm(`Delete invoice ${tx.invoiceNumber}? This cannot be undone.`)) return;
    setActionError(null);
    try {
      const res = await fetch(`${TRANSACTIONS_API_BASE}?id=${tx.id}`, {
        method: "DELETE",
        headers: { "X-User-Role": user?.role ?? "" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data.error as string) || "Delete failed");
      await loadTransactions();
      if (selectedInvoice?.id === tx.id) setSelectedInvoice(null);
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  const handleSaveEditInvoice = async (updated: Transaction) => {
    if (!isSuperAdmin) return;
    setActionError(null);
    try {
      const res = await fetch(`${TRANSACTIONS_API_BASE}?id=${updated.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-User-Role": user?.role ?? "",
        },
        body: JSON.stringify({
          customerId: updated.customerId,
          customerName: updated.customerName,
          items: updated.items,
          subtotal: updated.subtotal,
          discount: updated.discount,
          tax: updated.tax,
          total: updated.total,
          paymentMethod: updated.paymentMethod,
          date: updated.date,
          invoiceNumber: updated.invoiceNumber,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data.error as string) || "Update failed");
      await loadTransactions();
      setEditingInvoice(null);
      setSelectedInvoice(updated);
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  const printInvoice = (inv: Transaction) => {
    try {
      openPrintWindow(`Invoice ${inv.invoiceNumber}`, buildInvoiceHtml(inv));
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportCsv = () => {
    const rows = filtered.length ? filtered : transactions;
    downloadCsv("invoices-report.csv", rows.map((t) => ({
      id: t.id,
      invoiceNumber: t.invoiceNumber,
      date: t.date,
      customerName: t.customerName,
      paymentMethod: t.paymentMethod,
      subtotal: t.subtotal,
      discount: t.discount,
      tax: t.tax,
      total: t.total,
      itemCount: (t.items ?? []).length,
    })));
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-1">{transactions.length} invoices</p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium border border-border hover:bg-accent transition-colors"
        >
          <Download className="h-4 w-4 mr-2 inline" />
          Export CSV
        </button>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-md w-full">
          <label htmlFor="invoice-search" className="sr-only">
            Search invoices
          </label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            id="invoice-search"
            type="text"
            placeholder="Search by invoice # or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-card text-foreground text-sm rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex flex-wrap gap-2 text-xs md:text-sm">
          <div className="space-y-1">
            <label htmlFor="invoice-from" className="text-muted-foreground">
              From
            </label>
            <input
              id="invoice-from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-2 py-1.5 bg-card text-foreground rounded-md border border-border text-xs md:text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="invoice-to" className="text-muted-foreground">
              To
            </label>
            <input
              id="invoice-to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-2 py-1.5 bg-card text-foreground rounded-md border border-border text-xs md:text-sm"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 sm:px-4 text-muted-foreground font-medium">Invoice #</th>
              <th className="text-left py-3 px-4 text-muted-foreground font-medium">Date</th>
              <th className="text-left py-3 px-4 text-muted-foreground font-medium">Customer</th>
              <th className="text-left py-3 px-4 text-muted-foreground font-medium">Items</th>
              <th className="text-left py-3 px-4 text-muted-foreground font-medium">Payment</th>
              <th className="text-right py-3 px-4 text-muted-foreground font-medium">Total</th>
              <th className="text-center py-3 px-4 text-muted-foreground font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((t) => (
              <tr key={t.id} className="border-b border-border last:border-0 hover:bg-accent/50">
                <td className="py-3 px-4 font-medium text-primary">{t.invoiceNumber}</td>
                <td className="py-3 px-4 text-muted-foreground">{t.date}</td>
                <td className="py-3 px-4 text-foreground">{t.customerName}</td>
                <td className="py-3 px-4 text-muted-foreground">{(t.items ?? []).length} service{(t.items ?? []).length > 1 ? "s" : ""}</td>
                <td className="py-3 px-4">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-xs font-medium capitalize",
                    t.paymentMethod === "cash" ? "bg-success/10 text-success" :
                    t.paymentMethod === "card" ? "bg-primary/10 text-primary" :
                    "bg-accent text-accent-foreground"
                  )}>
                    {t.paymentMethod}
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-heading font-bold text-foreground">Rs. {Number(t.total ?? 0).toFixed(2)}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-center gap-1 flex-wrap">
                    <button
                      onClick={() => setSelectedInvoice(t)}
                      className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => printInvoice(t)}
                      className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      title="Download PDF"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => printInvoice(t)}
                      className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      title="Print"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                    {isSuperAdmin && (
                      <>
                        <button
                          onClick={() => setEditingInvoice(t)}
                          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteInvoice(t)}
                          className="p-1.5 rounded hover:bg-destructive/20 text-destructive transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-muted-foreground">No invoices found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <div className="flex items-center justify-between gap-3 text-xs sm:text-sm text-muted-foreground">
          <div>
            Showing{" "}
            <span className="font-medium text-foreground">
              {(page - 1) * pageSize + 1}-
              {Math.min(page * pageSize, filtered.length)}
            </span>{" "}
            of <span className="font-medium text-foreground">{filtered.length}</span> invoices
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 rounded border border-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent transition-colors"
            >
              Prev
            </button>
            <span>
              Page <span className="font-medium text-foreground">{page}</span> of{" "}
              <span className="font-medium text-foreground">{totalPages}</span>
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2 py-1 rounded border border-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-foreground/20 z-50 flex items-center justify-center p-4" onClick={() => setSelectedInvoice(null)}>
          <div className="bg-card border border-border rounded-lg w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-heading font-bold text-card-foreground">{selectedInvoice.invoiceNumber}</h2>
                  <p className="text-xs text-muted-foreground">{selectedInvoice.date}</p>
                </div>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium text-foreground">{selectedInvoice.customerName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payment Method</span>
                <span className="font-medium text-foreground capitalize">{selectedInvoice.paymentMethod}</span>
              </div>

              {/* Items */}
              <div className="border border-border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary/50">
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Service</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Employee</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">Qty</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.items.map((item, idx) => (
                      <tr key={idx} className="border-t border-border">
                        <td className="py-2 px-3 text-foreground">{item.serviceName}</td>
                        <td className="py-2 px-3 text-muted-foreground">{item.employeeName}</td>
                        <td className="py-2 px-3 text-center text-foreground">{item.quantity}</td>
                        <td className="py-2 px-3 text-right text-foreground">Rs. {(item.price * item.quantity).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="space-y-1.5 text-sm pt-2">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="text-foreground">Rs. {Number(selectedInvoice.subtotal ?? 0).toFixed(2)}</span>
                </div>
                {selectedInvoice.discount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Discount</span>
                    <span className="text-destructive">-Rs. {Number(selectedInvoice.discount ?? 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax</span>
                  <span className="text-foreground">Rs. {Number(selectedInvoice.tax ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-heading font-bold text-base pt-2 border-t border-border text-foreground">
                  <span>Grand Total</span>
                  <span>Rs. {Number(selectedInvoice.total ?? 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="border-t border-border p-4 flex gap-2">
              <button
                onClick={() => printInvoice(selectedInvoice)}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Printer className="h-4 w-4" /> Print
              </button>
              <button
                onClick={() => printInvoice(selectedInvoice)}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium border border-border hover:bg-accent transition-colors"
              >
                <Download className="h-4 w-4" /> PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Invoice Modal (Super Admin only) */}
      {editingInvoice && isSuperAdmin && (
        <EditInvoiceModal
          transaction={editingInvoice}
          onClose={() => { setEditingInvoice(null); setActionError(null); }}
          onSave={handleSaveEditInvoice}
          error={actionError}
        />
      )}
    </div>
  );
};

function EditInvoiceModal({
  transaction,
  onClose,
  onSave,
  error,
}: {
  transaction: Transaction;
  onClose: () => void;
  onSave: (tx: Transaction) => void;
  error: string | null;
}) {
  const [customerName, setCustomerName] = useState(transaction.customerName);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "online">(
    transaction.paymentMethod === "cash" || transaction.paymentMethod === "card" || transaction.paymentMethod === "online"
      ? transaction.paymentMethod
      : "cash"
  );
  const [date, setDate] = useState(transaction.date);
  const [invoiceNumber, setInvoiceNumber] = useState(transaction.invoiceNumber);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...transaction,
      customerName,
      paymentMethod,
      date,
      invoiceNumber,
    });
  };

  return (
    <div className="fixed inset-0 bg-foreground/20 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-heading font-semibold text-card-foreground">Edit Invoice</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        {error && (
          <div className="mb-4 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Customer name</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Payment method</label>
            <select
              value={paymentMethod}
              onChange={(e) => {
                const v = e.target.value as "cash" | "card" | "online";
                if (v === "cash" || v === "card" || v === "online") setPaymentMethod(v);
              }}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="online">Online</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Invoice number</label>
            <input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">Line items and totals are not editable here.</p>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium">
              Save changes
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Invoices;
