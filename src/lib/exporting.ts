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

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPKR(value: number) {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
}

const PRINT_STYLES = `
  :root {
    color-scheme: light;
    --receipt-width: 80mm;
    --text: #000;
    --muted: #000; /* thermal printer ke liye dark rakha hai */
    --line: #000;
  }

  @page {
    size: 80mm auto;
    margin: 0;
  }

  html, body {
    margin: 0;
    padding: 0;
    width: var(--receipt-width);
    background: #fff;
    color: var(--text);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    line-height: 1.28;
    font-weight: 700;
    padding: 4px 6px 8px;
    box-sizing: border-box;
    text-rendering: optimizeLegibility;
  }

  * {
    box-sizing: border-box;
  }

  .receipt {
    width: 100%;
    box-sizing: border-box;
  }

  .center { text-align: center; }
  .right { text-align: right; }
  .left { text-align: left; }

  .separator {
    border-top: 1px dashed var(--line);
    margin: 6px 0;
    width: 100%;
  }

  .separator-strong {
    border-top: 2px solid var(--line);
    margin: 7px 0;
    width: 100%;
  }

  /* =========================
     HEADER
  ========================= */
  .invoice-header {
    text-align: center;
    padding-bottom: 6px;
  }

  .logo-wrap {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 6px;
  }

  .invoice-header img {
    display: block;
    margin: 0 auto;
    max-width: 100%;
    width: auto;
    height: auto;
    max-height: 85px;
    object-fit: contain;
  }

  .company-name {
    font-size: 17px;
    font-weight: 900;
    letter-spacing: 0.2px;
    margin: 0;
    line-height: 1.2;
    text-transform: uppercase;
    color: #000;
  }

  .company-tagline {
    font-size: 11px;
    font-weight: 900;
    color: #000;
    margin: 4px 0 0;
    line-height: 1.25;
    white-space: normal;
    word-break: break-word;
  }

  .company-meta {
    font-size: 10.5px;
    font-weight: 800;
    color: #000;
    margin-top: 4px;
    line-height: 1.25;
  }

  /* =========================
     TITLE
  ========================= */
  .invoice-title {
    text-align: center;
    font-size: 14px;
    font-weight: 900;
    margin: 4px 0 6px;
    letter-spacing: 0.4px;
    text-transform: uppercase;
  }

  /* =========================
     META TABLE
  ========================= */
  .meta-table,
  .items-table,
  .totals-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .meta-table td {
    padding: 2px 0;
    vertical-align: top;
    font-size: 10.8px;
    word-wrap: break-word;
  }

  .meta-label {
    width: 34%;
    font-weight: 900;
  }

  .meta-value {
    width: 66%;
    text-align: right;
    font-weight: 800;
  }

  /* =========================
     ITEMS TABLE
  ========================= */
  .items-table {
    margin-top: 4px;
  }

  .items-table th,
  .items-table td {
    padding: 4px 0;
    vertical-align: top;
    word-break: break-word;
  }

  .items-table thead th {
    border-bottom: 1px solid #000;
    font-size: 10.8px;
    font-weight: 900;
    padding-bottom: 4px;
  }

  .items-table tbody td {
    border-bottom: 1px dashed #777;
    font-size: 10.6px;
  }

  .col-service {
    width: 46%;
    text-align: left;
    padding-right: 4px;
  }

  .col-qty {
    width: 12%;
    text-align: center;
  }

  .col-rate {
    width: 18%;
    text-align: right;
    white-space: nowrap;
    padding-right: 2px;
  }

  .col-amount {
    width: 24%;
    text-align: right;
    white-space: nowrap;
  }

  .service-name {
    font-weight: 900;
    line-height: 1.2;
  }

  .service-employee {
    display: block;
    margin-top: 1px;
    font-size: 9.5px;
    font-weight: 800;
    color: #000;
    line-height: 1.15;
  }

  /* =========================
     TOTALS
  ========================= */
  .totals-table {
    margin-top: 6px;
  }

  .totals-table td {
    padding: 2px 0;
    border: none;
    font-size: 10.8px;
  }

  .totals-label {
    width: 62%;
    color: #000;
    font-weight: 900;
  }

  .totals-value {
    width: 38%;
    text-align: right;
    white-space: nowrap;
    font-weight: 900;
  }

  .grand-total-row td {
    border-top: 2px solid #000;
    border-bottom: 2px solid #000;
    padding-top: 5px;
    padding-bottom: 5px;
    font-size: 13px;
    font-weight: 900;
  }

  /* =========================
     FOOTER / NOTES
  ========================= */
  .amount-note {
    margin-top: 6px;
    font-size: 9.8px;
    font-weight: 800;
    color: #000;
    line-height: 1.25;
  }

  .terms {
    margin-top: 8px;
    font-size: 9.8px;
    font-weight: 800;
    line-height: 1.25;
  }

  .terms-title {
    font-weight: 900;
    margin-bottom: 3px;
    text-transform: uppercase;
  }

  .terms ul {
    margin: 4px 0 0;
    padding-left: 14px;
  }

  .terms li {
    margin: 2px 0;
  }

  .footer {
    margin-top: 10px;
    text-align: center;
  }

  .thank-you {
    font-size: 11px;
    font-weight: 900;
    margin: 0;
    text-transform: uppercase;
  }

  .footer-note {
    margin-top: 3px;
    font-size: 9.8px;
    color: #000;
    font-weight: 800;
    line-height: 1.2;
  }
  .powered-by {
  margin-top: 6px;
  padding-top: 4px;
  border-top: 1px dashed #777;
  font-size: 8.6px;
  color: #000;
  font-weight: 800;
  line-height: 1.2;
  text-align: center;
  letter-spacing: 0.2px;
}  

  @media print {
    html, body {
      width: 80mm;
      overflow: hidden;
    }

    body {
      padding: 4px 6px 8px;
    }
  }
`;

export type ProfessionalInvoiceOptions = {
  companyName?: string;
  companyTagline?: string;
  companyAddress?: string;
  companyPhone?: string;
  logoUrl?: string;
  cashierName?: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  paymentMethod?: string;
  items: Array<{
    serviceName: string;
    employeeName?: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount?: number;
  balanceAmount?: number;
  terms?: string[];
};

const DEFAULT_TERMS = [
  "Please keep this receipt for future reference.",
  "Service once delivered may not be refundable.",
  "Follow after-care instructions for best results.",
  "Thank you for choosing our salon services.",
];

export function buildProfessionalInvoiceHtml(options: ProfessionalInvoiceOptions): string {
  const {
    companyName = "Sheeza Salon",
    companyTagline = "Professional Beauty & Care Services",
    companyAddress = "",
    companyPhone = "",
    // IMPORTANT:
    // Make sure your image is inside: public/brand.jpeg
    // Then this absolute path works reliably in iframe print
    logoUrl = `${window.location.origin}/brand.jpeg`,
    cashierName,
    invoiceNumber,
    date,
    customerName,
    paymentMethod = "Cash",
    items,
    subtotal,
    discount,
    tax,
    total,
    paidAmount = total,
    balanceAmount = 0,
    terms = DEFAULT_TERMS,
  } = options;

  const safeItems = Array.isArray(items) ? items : [];

  const rows = safeItems
    .map((it) => {
      const qty = Number(it.quantity || 0);
      const price = Number(it.price || 0);
      const lineTotal = Number(it.total ?? price * qty);

      return `
        <tr>
          <td class="col-service">
            <span class="service-name">${escapeHtml(it.serviceName)}</span>
            ${
              it.employeeName
                ? `<span class="service-employee">By: ${escapeHtml(it.employeeName)}</span>`
                : ""
            }
          </td>
          <td class="col-qty">${qty}</td>
          <td class="col-rate">${formatPKR(price)}</td>
          <td class="col-amount">${formatPKR(lineTotal)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="receipt">
      <div class="invoice-header">
        ${
          logoUrl
            ? `
              <div class="logo-wrap">
                <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(companyName)}" />
              </div>
            `
            : ""
        }

        <h1 class="company-name">${escapeHtml(companyName)}</h1>

        ${
          companyTagline
            ? `<p class="company-tagline">${escapeHtml(companyTagline)}</p>`
            : ""
        }

        ${
          companyAddress || companyPhone
            ? `
              <div class="company-meta">
                ${companyAddress ? `<div>${escapeHtml(companyAddress)}</div>` : ""}
                ${companyPhone ? `<div>${escapeHtml(companyPhone)}</div>` : ""}
              </div>
            `
            : ""
        }
      </div>

      <div class="separator-strong"></div>

      <h2 class="invoice-title">Customer Invoice</h2>

      <table class="meta-table" aria-label="Invoice Details">
        <tbody>
          <tr>
            <td class="meta-label">Invoice #</td>
            <td class="meta-value">${escapeHtml(invoiceNumber)}</td>
          </tr>
          <tr>
            <td class="meta-label">Date</td>
            <td class="meta-value">${escapeHtml(date)}</td>
          </tr>
          <tr>
            <td class="meta-label">Customer</td>
            <td class="meta-value">${escapeHtml(customerName)}</td>
          </tr>
          <tr>
            <td class="meta-label">Payment</td>
            <td class="meta-value">${escapeHtml(paymentMethod)}</td>
          </tr>
          ${
            cashierName
              ? `
                <tr>
                  <td class="meta-label">Cashier</td>
                  <td class="meta-value">${escapeHtml(cashierName)}</td>
                </tr>
              `
              : ""
          }
        </tbody>
      </table>

      <div class="separator"></div>

      <table class="items-table" aria-label="Invoice Items">
        <thead>
          <tr>
            <th class="col-service">Service</th>
            <th class="col-qty">Qty</th>
            <th class="col-rate">Rate</th>
            <th class="col-amount">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows ||
            `
              <tr>
                <td colspan="4" class="center" style="padding: 8px 0;">No items found</td>
              </tr>
            `
          }
        </tbody>
      </table>

      <div class="separator"></div>

      <table class="totals-table" aria-label="Totals">
        <tbody>
          <tr>
            <td class="totals-label">Subtotal</td>
            <td class="totals-value">${formatPKR(subtotal)}</td>
          </tr>
          ${
            Number(discount) > 0
              ? `
                <tr>
                  <td class="totals-label">Discount</td>
                  <td class="totals-value">- ${formatPKR(discount)}</td>
                </tr>
              `
              : ""
          }
          <tr>
            <td class="totals-label">Tax</td>
            <td class="totals-value">${formatPKR(tax)}</td>
          </tr>
          <tr class="grand-total-row">
            <td class="totals-label">Grand Total</td>
            <td class="totals-value">${formatPKR(total)}</td>
          </tr>
          <tr>
            <td class="totals-label">Paid</td>
            <td class="totals-value">${formatPKR(paidAmount)}</td>
          </tr>
          <tr>
            <td class="totals-label">Balance</td>
            <td class="totals-value">${formatPKR(balanceAmount)}</td>
          </tr>
        </tbody>
      </table>

      <div class="amount-note">
        This is a computer-generated receipt and does not require a signature.
      </div>

      <div class="separator"></div>

      <div class="terms">
        <div class="terms-title">Terms & Conditions</div>
        <ul>
          ${terms.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}
        </ul>
      </div>

      <div class="separator-strong"></div>

      <div class="footer">
        <p class="thank-you">Thank You For Visiting</p>
        <div class="footer-note">We look forward to serving you again.</div>
        <div class="powered-by">Powered by ZepTechLogix • Software Solutions</div>
      </div>
    </div>
  `;
}

const PRINT_HTML = (title: string, bodyHtml: string) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>${PRINT_STYLES}</style>
  </head>
  <body>${bodyHtml}</body>
</html>`;

export function openPrintWindow(title: string, bodyHtml: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute(
    "style",
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;"
  );

  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win?.document;

  if (!doc || !win) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(PRINT_HTML(title, bodyHtml));
  doc.close();

  const images = Array.from(doc.images ?? []);

  const waitForImages = Promise.all(
    images.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            })
    )
  );

  const waitForFonts =
    "fonts" in doc
      ? (doc as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready ?? Promise.resolve()
      : Promise.resolve();

  const timeout = new Promise<void>((resolve) => {
    // logo + thermal print reliability ke liye zyada wait
    window.setTimeout(() => resolve(), 3000);
  });

  void Promise.race([
    Promise.all([waitForImages, waitForFonts]).then(() => undefined),
    timeout,
  ]).then(() => {
    win.focus();
    win.print();

    window.setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 1000);
  });
}