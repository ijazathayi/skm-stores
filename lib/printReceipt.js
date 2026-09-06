// ── Receipt Printer Utility ──
import { esc } from './helpers';

export function getReceiptHTML(bill, profile = {}, options = {}) {
  const storeName = profile.storeName || 'SKM STORES';
  const storePhone = profile.storePhone || '';
  const storeAddress = profile.storeAddress || '';
  const receiptFooter = profile.receiptFooter || 'THANK YOU VISIT AGAIN';

  const width = options.width || (typeof window !== 'undefined' ? Number(localStorage.getItem('skm_printWidth') || 58) : 58);
  const lang = options.lang || (typeof window !== 'undefined' ? localStorage.getItem('skm_printLang') || 'en' : 'en');
  const isTa = lang === 'ta';

  const d = new Date(bill.timestamp || Date.now());
  const dateStr = d.toLocaleDateString('en-GB');
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const labelInvoice = isTa ? 'சில்லறை விலைப்பட்டியல்' : 'RETAIL INVOICE';
  const labelBillNo = isTa ? 'ரசீது எண்' : 'BILL NO';
  const labelDate = isTa ? 'தேதி' : 'DATE';
  const labelTime = isTa ? 'நேரம்' : 'TIME';
  const labelItem = isTa ? 'பொருள்' : 'ITEM';
  const labelQty = isTa ? 'அளவு' : 'Q';
  const labelRate = isTa ? 'விலை' : 'RATE';
  const labelTotal = isTa ? 'மொத்தம்' : 'TOTAL';
  const labelGrandTotal = isTa ? 'மொத்த தொகை' : 'GRAND TOTAL';
  const labelThanks = isTa ? 'நன்றி! மீண்டும் வருக' : receiptFooter;

  const contentWidth = Math.max(38, width - 4);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt #${bill.billNo || ''}</title>
  <style>
    @page {
      size: ${width}mm auto;
      margin: 0;
    }
    @media print {
      html, body {
        margin: 0 !important;
        padding: 0 !important;
      }
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      width: ${contentWidth}mm;
      max-width: ${contentWidth}mm;
      margin: 0 auto;
      padding: 2mm 1.5mm;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Courier New", monospace, sans-serif;
      font-size: 10px;
      line-height: 1.25;
      color: #000;
      background: #fff;
    }
    .c { text-align: center; }
    .r { text-align: right; }
    .b { font-weight: bold; }
    .logo-wrap { text-align: center; margin-bottom: 3px; }
    .logo { width: 44px; height: 44px; object-fit: cover; border-radius: 8px; display: inline-block; }
    .title { font-size: 15px; font-weight: 900; letter-spacing: 0.5px; margin: 2px 0 1px; }
    .sub { font-size: 9.5px; margin: 1px 0; color: #111; }
    .tag { font-size: 9.5px; font-weight: 700; margin: 3px 0 2px; }
    .meta { font-size: 9.5px; margin: 3px 0; }
    .line { border-top: 1px dashed #000; margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 9.5px; table-layout: fixed; }
    th, td { padding: 2px 1px; vertical-align: top; word-break: break-word; overflow-wrap: anywhere; }
    th { font-size: 9px; font-weight: 700; }
    .total-row { font-size: 11px; font-weight: 900; }
    .thanks { font-size: 11px; font-weight: 900; letter-spacing: 0.3px; margin-top: 5px; }
  </style>
</head>
<body>
  <div class="logo-wrap">
    <img src="/skm-logo.png" class="logo" alt="SKM" onerror="this.style.display='none'" />
  </div>
  <div class="c title">${esc(storeName)}</div>
  ${storeAddress ? `<div class="c sub">${esc(storeAddress)}</div>` : ''}
  ${storePhone ? `<div class="c sub">Ph: ${esc(storePhone)}</div>` : ''}
  <div class="c tag">${labelInvoice}</div>

  <div class="meta">
    <div><span class="b">${labelBillNo}:</span> #${bill.billNo || '—'}</div>
    <div><span class="b">${labelDate}:</span> ${dateStr} &nbsp; <span class="b">${labelTime}:</span> ${timeStr}</div>
  </div>

  <div class="line"></div>

  <table>
    <thead>
      <tr>
        <th style="width: 10%; text-align: left;">#</th>
        <th style="width: 44%; text-align: left;">${labelItem}</th>
        <th style="width: 14%; text-align: center;">${labelQty}</th>
        <th style="width: 16%; text-align: right;">${labelRate}</th>
        <th style="width: 16%; text-align: right;">${labelTotal}</th>
      </tr>
    </thead>
    <tbody>
      ${(bill.items || []).map((it, idx) => `
        <tr>
          <td style="text-align: left;">${idx + 1}</td>
          <td style="text-align: left;">${esc(it.name)}</td>
          <td style="text-align: center;">${it.qty}</td>
          <td class="r">${Number(it.price).toFixed(2)}</td>
          <td class="r">${(it.qty * it.price).toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="line"></div>

  <table>
    <tr class="total-row">
      <td style="text-align: left;">${labelGrandTotal}</td>
      <td class="r">₹${Number(bill.total || 0).toFixed(2)}</td>
    </tr>
  </table>

  <div class="line"></div>
  <div class="c thanks">${esc(labelThanks)}</div>
  <br />
</body>
</html>`;
}

export function printReceipt(bill, profile = {}, options = {}) {
  if (typeof window === 'undefined') return;

  const html = getReceiptHTML(bill, profile, options);

  // Method 1: Hidden iframe print (fastest, keeps user on the same screen)
  try {
    let iframe = document.getElementById('receiptPrintIframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'receiptPrintIframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    const triggerPrint = () => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    };

    // Check if image loads or trigger after timeout
    const img = doc.querySelector('img');
    if (img && !img.complete) {
      img.onload = () => setTimeout(triggerPrint, 60);
      img.onerror = () => setTimeout(triggerPrint, 60);
      setTimeout(triggerPrint, 250); // safety fallback
    } else {
      setTimeout(triggerPrint, 100);
    }
  } catch (err) {
    console.warn('Iframe print failed, falling back to window.open:', err);
    // Fallback: new window
    const w = window.open('', '_blank', 'width=420,height=650');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => { w.print(); }, 250);
    }
  }
}
