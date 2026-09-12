import { BLACK_LOGO_DATA_URL } from './logoData';
import { getProductName } from './translations';

const printerServiceUuids = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
];

function canvasToRasterCommand(canvas) {
  const context = canvas.getContext('2d');
  const { width, height } = canvas;
  const pixels = context.getImageData(0, 0, width, height).data;
  const bytesPerRow = Math.ceil(width / 8);
  const raster = new Uint8Array(bytesPerRow * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = (y * width + x) * 4;
      const darkness = (pixels[pixel] + pixels[pixel + 1] + pixels[pixel + 2]) / 3;
      if (pixels[pixel + 3] > 20 && darkness < 160) {
        raster[y * bytesPerRow + Math.floor(x / 8)] |= 0x80 >> (x % 8);
      }
    }
  }

  const header = new Uint8Array([
    0x1d, 0x76, 0x30, 0x00,
    bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff,
    height & 0xff, (height >> 8) & 0xff,
  ]);
  const output = new Uint8Array(header.length + raster.length);
  output.set(header);
  output.set(raster, header.length);
  return output;
}

function receiptText(bill, profile = {}, lang = 'en') {
  const isTa = lang === 'ta';
  const line = '-'.repeat(32);
  const rows = (bill.items || []).map((item, index) => {
    const name = getProductName(item, lang).slice(0, 18);
    const amount = ((Number(item.qty) || 0) * (Number(item.price) || 0)).toFixed(2);
    return `${String(index + 1).padEnd(2)} ${name.padEnd(18)} ${amount.padStart(8)}`;
  });

  return [
    '\x1b\x61\x01', profile.storeName || (isTa ? 'எஸ்கேஎம் ஸ்டோர்ஸ்' : 'SKM STORES'),
    isTa ? 'சில்லறை விற்பனை ரசீது' : 'RETAIL INVOICE',
    `${isTa ? 'ரசீது எண்' : 'Bill No'}: #${bill.billNo || ''}`,
    new Date(bill.timestamp || Date.now()).toLocaleString('en-GB'),
    '\x1b\x61\x00', line, isTa ? '#  பொருள்              தொகை' : '#  ITEM                 TOTAL', ...rows,
    line, `${isTa ? 'மொத்தம்' : 'TOTAL'}:                  Rs.${Number(bill.total || 0).toFixed(2)}`,
    '\x1b\x61\x01', profile.receiptFooter || (isTa ? 'நன்றி மீண்டும் வருக!' : 'THANK YOU VISIT AGAIN'),
  ].join('\n');
}

async function logoRaster() {
  const image = new Image();
  image.src = BLACK_LOGO_DATA_URL;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });

  const width = 160;
  const height = Math.max(1, Math.round(width * image.height / image.width));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvasToRasterCommand(canvas);
}

async function tamilReceiptRaster(bill, profile) {
  const width = 384;
  const rowHeight = 32;
  const items = bill.items || [];
  const height = 280 + items.length * rowHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#000';
  context.textAlign = 'center';
  context.textBaseline = 'top';

  const logo = new Image();
  logo.src = BLACK_LOGO_DATA_URL;
  await new Promise((resolve, reject) => {
    logo.onload = resolve;
    logo.onerror = reject;
  });
  context.drawImage(logo, 152, 8, 80, 80);
  context.font = 'bold 24px "Noto Sans Tamil", Latha, sans-serif';
  context.fillText(profile.storeName || 'எஸ்கேஎம் ஸ்டோர்ஸ்', width / 2, 94);
  context.font = 'bold 20px "Noto Sans Tamil", Latha, sans-serif';
  context.fillText('சில்லறை விற்பனை ரசீது', width / 2, 124);
  context.font = '18px "Noto Sans Tamil", Latha, sans-serif';
  context.fillText(`ரசீது எண்: #${bill.billNo || ''}`, width / 2, 150);
  context.fillText(new Date(bill.timestamp || Date.now()).toLocaleDateString('en-GB'), width / 2, 176);

  let y = 212;
  context.strokeStyle = '#000';
  context.beginPath();
  context.moveTo(12, y - 8);
  context.lineTo(width - 12, y - 8);
  context.stroke();
  context.font = 'bold 18px "Noto Sans Tamil", Latha, sans-serif';
  context.textAlign = 'left';
  context.fillText('#', 14, y);
  context.fillText('பொருள்', 48, y);
  context.textAlign = 'right';
  context.fillText('தொகை', width - 14, y);
  y += 30;
  context.font = '18px "Noto Sans Tamil", Latha, sans-serif';
  items.forEach((item, index) => {
    const name = getProductName(item, 'ta').slice(0, 20);
    const amount = ((Number(item.qty) || 0) * (Number(item.price) || 0)).toFixed(2);
    context.textAlign = 'left';
    context.fillText(String(index + 1), 14, y);
    context.fillText(name, 48, y);
    context.textAlign = 'right';
    context.fillText(amount, width - 14, y);
    y += rowHeight;
  });
  context.beginPath();
  context.moveTo(12, y - 8);
  context.lineTo(width - 12, y - 8);
  context.stroke();
  context.font = 'bold 21px "Noto Sans Tamil", Latha, sans-serif';
  context.textAlign = 'left';
  context.fillText('மொத்தம்:', 14, y + 8);
  context.textAlign = 'right';
  context.fillText(`Rs.${Number(bill.total || 0).toFixed(2)}`, width - 14, y + 8);
  context.font = 'bold 20px "Noto Sans Tamil", Latha, sans-serif';
  context.textAlign = 'center';
  context.fillText(profile.receiptFooter || 'நன்றி மீண்டும் வருக!', width / 2, y + 52);
  return canvasToRasterCommand(canvas);
}

async function findWritableCharacteristic(server) {
  const services = await server.getPrimaryServices();
  for (const service of services) {
    const characteristics = await service.getCharacteristics();
    const writable = characteristics.find((characteristic) =>
      characteristic.properties.write || characteristic.properties.writeWithoutResponse,
    );
    if (writable) return writable;
  }
  throw new Error('No writable printer characteristic was found.');
}

export function supportsBluetoothPrinting() {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

export async function printReceiptBluetooth(bill, profile = {}, options = {}) {
  if (!supportsBluetoothPrinting()) {
    throw new Error('This browser does not support Bluetooth printing.');
  }

  let device;
  if (navigator.bluetooth.getDevices) {
    const authorizedDevices = await navigator.bluetooth.getDevices();
    device = authorizedDevices.find((candidate) => candidate.gatt);
  }
  if (!device) {
    device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: printerServiceUuids,
    });
  }
  const server = await device.gatt.connect();
  const characteristic = await findWritableCharacteristic(server);
  const lang = options.lang || profile.printLang || (localStorage.getItem('skm_lang') || 'en');
  const prefix = new Uint8Array([0x1b, 0x40]);
  const receipt = lang === 'ta'
    ? await tamilReceiptRaster(bill, profile)
    : new Uint8Array([
      ...[0x1b, 0x61, 0x01],
      ...await logoRaster(),
      ...new TextEncoder().encode(receiptText(bill, profile, lang)),
    ]);
  const suffix = new Uint8Array([0x0a, 0x0a, 0x1d, 0x56, 0x00]);
  const data = new Uint8Array(prefix.length + receipt.length + suffix.length);
  data.set(prefix);
  data.set(receipt, prefix.length);
  data.set(suffix, prefix.length + receipt.length);
  const chunkSize = characteristic.properties.writeWithoutResponse ? 180 : 512;

  for (let offset = 0; offset < data.length; offset += chunkSize) {
    const chunk = data.slice(offset, offset + chunkSize);
    if (characteristic.properties.writeWithoutResponse && characteristic.writeValueWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValue(chunk);
    }
  }

  return device.name || 'Bluetooth printer';
}