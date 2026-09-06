'use client';
import { useEffect, useCallback, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { useStore } from '@/lib/store';

/* ─────────────────────────────────────────────
   Scoped styles — bm-* prefix keeps them from
   bleeding into the rest of the SKM app.
───────────────────────────────────────────── */
const CSS = `
.bm-root {
  min-height: 100dvh;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  padding: 24px 16px 80px;
  font-family: sans-serif;
  background-color: #f4f4f9;
  overflow-x: hidden;
}

.bm-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 700;
  color: #007bff;
  text-decoration: none;
  margin-bottom: 16px;
  align-self: flex-start;
}
.bm-back:hover { text-decoration: underline; }

#bm-bill-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #ffffff;
  width: min(60%, 680px);
  margin-bottom: 20px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.10);
  border-radius: 6px;
  overflow: hidden;
}

#bm-shop-header {
  width: 100%;
  background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
  color: #ffffff;
  text-align: center;
  padding: 16px 12px 12px;
}
#bm-shop-name {
  font-size: clamp(16px, 4vw, 24px);
  font-weight: 800;
  letter-spacing: 3px;
  text-transform: uppercase;
  font-family: 'Georgia', serif;
  text-shadow: 1px 1px 3px rgba(0,0,0,0.3);
}
#bm-shop-tagline {
  font-size: clamp(10px, 2.5vw, 13px);
  letter-spacing: 1.5px;
  margin-top: 4px;
  opacity: 0.9;
  font-style: italic;
}
#bm-shop-divider {
  width: 50%;
  height: 1px;
  background: rgba(255,255,255,0.4);
  margin: 8px auto 6px;
}
#bm-bill-date {
  font-size: clamp(10px, 2vw, 12px);
  opacity: 0.85;
  letter-spacing: 0.5px;
}

.bm-table-scroll {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

#bm-myTable {
  border-collapse: collapse;
  background: white;
  width: 100%;
  min-width: 320px;
}
#bm-myTable th,
#bm-myTable td {
  padding: clamp(4px, 1.5vw, 8px) clamp(4px, 1vw, 6px);
  text-align: center;
  border: 1px solid #ddd;
  font-size: clamp(11px, 2vw, 14px);
  white-space: nowrap;
}
#bm-myTable th {
  background-color: #007bff;
  color: white;
}

.bm-peices-inps {
  width: clamp(48px, 8vw, 70px);
  text-align: center;
  font-size: clamp(11px, 2vw, 14px);
  border: 1px solid #ccc;
  border-radius: 3px;
  padding: 2px 4px;
}
.bm-peices-inps::-webkit-outer-spin-button,
.bm-peices-inps::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.bm-peices-inps { -moz-appearance: textfield; }

#bm-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 16px;
}
.bm-download-btn {
  padding: clamp(8px, 2vw, 10px) clamp(16px, 4vw, 24px);
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  font-size: clamp(13px, 2.5vw, 15px);
  transition: background-color 0.2s, transform 0.15s;
  touch-action: manipulation;
}
.bm-download-btn:hover { background-color: #0056b3; }
.bm-download-btn:active { transform: scale(0.97); }

@media (max-width: 768px) {
  #bm-bill-wrapper { width: 90%; }
}
@media (max-width: 480px) {
  .bm-root { padding: 16px 8px 80px; }
  #bm-bill-wrapper { width: 100%; border-radius: 4px; }
  #bm-shop-name { letter-spacing: 2px; }
  #bm-buttons { width: 100%; gap: 8px; }
  .bm-download-btn { flex: 1; min-width: 120px; }
}
`;

/* ── Group items by section for rendering ── */
function groupBySection(prices) {
  const map = {};
  prices.forEach((item) => {
    if (!map[item.section]) map[item.section] = [];
    map[item.section].push(item);
  });
  return map;
}

export default function BuyMilk() {
  const { milkPrices } = useStore();

  // Local qty state: { [key]: number }
  const [qtys, setQtys] = useState(() =>
    Object.fromEntries(milkPrices.map((p) => [p.key, 0]))
  );
  // Local totals: { [key]: number }
  const [totals, setTotals] = useState(() =>
    Object.fromEntries(milkPrices.map((p) => [p.key, 0]))
  );
  const [grandPieces, setGrandPieces] = useState(0);
  const [grandTotal, setGrandTotal]   = useState(0);

  // Re-initialise qty keys if milkPrices changes (e.g. new item added in admin)
  useEffect(() => {
    setQtys((prev) => {
      const next = { ...prev };
      milkPrices.forEach((p) => { if (!(p.key in next)) next[p.key] = 0; });
      return next;
    });
  }, [milkPrices]);

  /* ── set today's date ── */
  useEffect(() => {
    const el = document.getElementById('bm-bill-date');
    if (el) el.innerHTML = '📅 ' + new Date().toLocaleDateString();
  }, []);

  /* ── recalculate whenever qty or prices change ── */
  const calculate = useCallback((newQtys) => {
    let gPieces = 0;
    let gTotal  = 0;
    const newTotals = {};
    milkPrices.forEach((item) => {
      const qty   = Number(newQtys[item.key]) || 0;
      const price = Number(item.wp) || 0;
      const t     = qty * price;
      newTotals[item.key] = t;
      gPieces += qty;
      gTotal  += t;
    });
    setTotals(newTotals);
    setGrandPieces(gPieces);
    setGrandTotal(gTotal);
  }, [milkPrices]);

  const handleQtyChange = (key, val) => {
    const next = { ...qtys, [key]: val };
    setQtys(next);
    calculate(next);
  };

  /* ── canvas / download / share ── */
  const generateCanvas = useCallback(async () => {
    const html2canvas = window.html2canvas;
    if (!html2canvas) throw new Error('html2canvas not loaded');

    const originalWrapper = document.getElementById('bm-bill-wrapper');
    const originalTable   = document.getElementById('bm-myTable');
    const wrapperClone    = originalWrapper.cloneNode(true);
    const tableClone      = wrapperClone.querySelector('#bm-myTable');

    wrapperClone.style.position   = 'absolute';
    wrapperClone.style.top        = '-9999px';
    wrapperClone.style.width      = '370px';
    wrapperClone.style.background = '#ffffff';
    wrapperClone.style.padding    = '0';
    document.body.appendChild(wrapperClone);

    // Replace inputs with plain text spans
    const origInputs  = originalTable.querySelectorAll('input');
    const cloneInputs = tableClone.querySelectorAll('input');
    origInputs.forEach((input, i) => {
      const span           = document.createElement('span');
      span.textContent     = input.value;
      span.style.display   = 'block';
      span.style.textAlign = 'center';
      span.style.fontSize  = 'inherit';
      cloneInputs[i].parentNode.replaceChild(span, cloneInputs[i]);
    });

    tableClone.style.width        = '100%';
    tableClone.style.marginBottom = '0';

    // Hide zero-qty item rows; collect section headers
    const rows = Array.from(tableClone.querySelectorAll('tr'));
    let lastSection = null;
    const sections  = [];

    rows.forEach((row) => {
      const span      = row.querySelector('td > span');
      const isItem    = !!span;
      const thEl      = row.querySelector('th[colspan]');
      const isHdr     = !isItem && thEl &&
        parseInt(thEl.getAttribute('colspan')) > 1 &&
        rows.indexOf(row) > 1 &&
        !row.querySelector('td');

      if (isHdr) {
        lastSection = { headerRow: row, itemRows: [] };
        sections.push(lastSection);
      } else if (isItem && lastSection) {
        lastSection.itemRows.push(row);
      }
    });

    rows.forEach((row) => {
      const span = row.querySelector('td > span');
      if (span && (parseFloat(span.textContent) || 0) === 0) {
        row.style.display = 'none';
      }
    });

    sections.forEach(({ headerRow, itemRows }) => {
      if (!itemRows.some((r) => r.style.display !== 'none')) {
        headerRow.style.display = 'none';
      }
    });

    // Strip wholesale price column
    tableClone.querySelectorAll('tr').forEach((row) => {
      if (row.style.display === 'none') return;
      if (row.cells.length > 1) row.deleteCell(1);
    });

    const canvas = await html2canvas(wrapperClone, { backgroundColor: '#ffffff', scale: 2 });
    document.body.removeChild(wrapperClone);
    return canvas;
  }, []);

  const downloadTableImage = useCallback(async () => {
    const canvas = await generateCanvas();
    const link   = document.createElement('a');
    link.download = `Milk_Bill_${new Date().toLocaleDateString()}.png`;
    link.href     = canvas.toDataURL('image/png');
    link.click();
  }, [generateCanvas]);

  const shareTableImage = useCallback(async () => {
    try {
      const canvas = await generateCanvas();
      canvas.toBlob(async (blob) => {
        const file = new File([blob], 'Milk_Bill.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Milk Bill' });
        } else {
          alert('Sharing not supported on this browser. Downloading instead…');
          downloadTableImage();
        }
      }, 'image/png');
    } catch (err) {
      console.error('Sharing failed:', err);
      downloadTableImage();
    }
  }, [generateCanvas, downloadTableImage]);

  const sections = groupBySection(milkPrices);

  return (
    <>
      <style>{CSS}</style>
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"
        strategy="lazyOnload"
      />

      <div className="bm-root">
        <Link href="/" className="bm-back">← Back</Link>

        {/* ── Bill wrapper (captured as image) ── */}
        <div id="bm-bill-wrapper">

          <div id="bm-shop-header">
            <div id="bm-shop-name">S.K.M STORES</div>
            <div id="bm-shop-tagline">🥛 Fresh Dairy &amp; Products</div>
            <div id="bm-shop-divider"></div>
            <div id="bm-bill-date"></div>
          </div>

          <div className="bm-table-scroll">
            <table id="bm-myTable">
              <tbody>
                {/* hidden date row for legacy compat */}
                <tr style={{ display: 'none' }}><th colSpan="4"></th></tr>

                {/* column headers */}
                <tr>
                  <th colSpan="5" style={{ display: 'none' }}></th>
                </tr>
                <tr>
                  <th>Packets</th>
                  <th>Wholesale Price</th>
                  <th>Price</th>
                  <th>No. of Pieces</th>
                  <th>Total Price</th>
                </tr>

                {Object.entries(sections).map(([section, items]) => (
                  <>
                    <tr key={`hdr-${section}`}>
                      <th colSpan="5">{section}</th>
                    </tr>
                    {items.map((item) => (
                      <tr key={item.key}>
                        <td>{item.label}</td>
                        <td>₹{Number(item.wp).toFixed(2)}</td>
                        <td>₹{Number(item.sp).toFixed(2)}</td>
                        <td>
                          <input
                            type="number"
                            className="bm-peices-inps"
                            value={qtys[item.key] ?? 0}
                            min="0"
                            max="200"
                            onChange={(e) => handleQtyChange(item.key, e.target.value)}
                          />
                        </td>
                        <td>₹{(totals[item.key] || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </>
                ))}

                {/* Grand total */}
                <tr style={{ background: '#f0f0f0', fontWeight: 'bold' }}>
                  <td colSpan="3">Grand Total</td>
                  <td>{grandPieces}</td>
                  <td>₹{grandTotal.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <section id="bm-buttons">
          <button className="bm-download-btn" onClick={downloadTableImage}>Download</button>
          <button className="bm-download-btn" onClick={shareTableImage}>Share Via..</button>
        </section>
      </div>
    </>
  );
}
