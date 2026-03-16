export function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvValue(v: unknown) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );

  const lines = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((r) => headers.map((h) => escapeCsvValue(r[h])).join(",")),
  ];

  downloadTextFile(filename, lines.join("\n"), "text/csv;charset=utf-8");
}

const PRINT_STYLES = `
  :root { color-scheme: light; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; margin: 24px; max-width: 800px; margin-left: auto; margin-right: auto; }
  .invoice-header { text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #333; }
  .invoice-header img { display: block; margin: 0 auto 8px; max-height: 140px; max-width: 100%; object-fit: contain; }
  .invoice-header h1 { margin: 8px 0 4px; font-size: 24px; }
  .invoice-header .tagline { color: #555; font-size: 14px; }
  h1.invoice-title { font-size: 20px; margin: 20px 0 8px; }
  .muted { color: #555; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; vertical-align: top; }
  .right { text-align: right; }
  .totals { margin-top: 16px; display: grid; grid-template-columns: 1fr auto; gap: 6px 16px; max-width: 360px; margin-left: auto; }
  .totals .label { color: #555; }
  .totals .value { text-align: right; }
  .totals .grand { font-weight: 700; font-size: 18px; border-top: 2px solid #000; padding-top: 8px; margin-top: 8px; }
  .terms { margin-top: 28px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 12px; color: #555; }
  .terms ul { margin: 8px 0 0; padding-left: 20px; }
  .thank-you { margin-top: 24px; text-align: center; font-size: 16px; font-weight: 600; }
  @media print { body { margin: 0.5in; } }
`;

export type ProfessionalInvoiceOptions = {
  companyName?: string;
  companyTagline?: string;
  logoUrl?: string;
  cashierName?: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  paymentMethod?: string;
  items: Array<{ serviceName: string; employeeName?: string; quantity: number; price: number; total: number }>;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  terms?: string[];
};

const DEFAULT_TERMS = [
  "Payment is due upon receipt unless otherwise agreed.",
  "We reserve the right to charge interest on overdue amounts.",
  "Prices are subject to change without notice.",
];

export function buildProfessionalInvoiceHtml(options: ProfessionalInvoiceOptions): string {
  const {
    companyName = "Sheeza saloon",
    companyTagline = "Quality care for your style",
    logoUrl = "/brand.jpeg",
    cashierName,
    invoiceNumber,
    date,
    customerName,
    paymentMethod = "",
    items,
    subtotal,
    discount,
    tax,
    total,
    terms = DEFAULT_TERMS,
  } = options;

  const rows = items
    .map(
      (it) => `
    <tr>
      <td>${it.serviceName}</td>
      <td class="right">${it.quantity}</td>
      <td class="right">Rs. ${(it.total ?? it.price * it.quantity).toFixed(2)}</td>
    </tr>`
    )
    .join("");

  return `
  <div class="invoice-header">
    ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" />` : ""}
    <h1>${companyName}</h1>
    ${companyTagline ? `<p class="tagline">${companyTagline}</p>` : ""}
    ${cashierName ? `<p class="muted"><strong>Cashier:</strong> ${cashierName}</p>` : ""}
  </div>
  <h1 class="invoice-title">INVOICE #${invoiceNumber}</h1>
  <p class="muted">Date: ${date}</p>
  <div style="margin: 12px 0;">
    <strong>Bill To:</strong> ${customerName}
    ${paymentMethod ? `<br /><strong>Payment:</strong> ${paymentMethod}` : ""}
  </div>
  <table>
    <thead>
      <tr>
        <th>Service</th>
        <th class="right">Qty</th>
        <th class="right">Amount (PKR)</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div class="label">Subtotal</div><div class="value">Rs. ${subtotal.toFixed(2)}</div>
    <div class="label">Discount</div><div class="value">-Rs. ${discount.toFixed(2)}</div>
    <div class="label">Tax</div><div class="value">Rs. ${tax.toFixed(2)}</div>
    <div class="label grand">Grand Total</div><div class="value grand">Rs. ${total.toFixed(2)}</div>
  </div>
  <div class="terms">
    <strong>Terms &amp; Conditions</strong>
    <ul>
      ${terms.map((t) => `<li>${t}</li>`).join("")}
    </ul>
  </div>
  <p class="thank-you">Thank you for your business!</p>
  `;
}

const PRINT_HTML = (title: string, bodyHtml: string) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>${PRINT_STYLES}</style>
  </head>
  <body>${bodyHtml}</body>
</html>`;

export function openPrintWindow(title: string, bodyHtml: string) {
  // Try popup first (user can "Save as PDF" from print dialog)
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (w) {
    w.document.write(PRINT_HTML(title, bodyHtml));
    w.document.close();
    w.focus();
    w.setTimeout(() => {
      w.print();
    }, 300);
    return;
  }

  // Fallback: hidden iframe (works when popups are blocked)
  const iframe = document.createElement("iframe");
  iframe.setAttribute("style", "position:absolute;width:0;height:0;border:0;visibility:hidden;");
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(PRINT_HTML(title, bodyHtml));
    doc.close();
    iframe.contentWindow?.focus();
    iframe.contentWindow?.setTimeout(() => {
      iframe.contentWindow?.print();
      document.body.removeChild(iframe);
    }, 300);
  } else {
    document.body.removeChild(iframe);
  }
}

