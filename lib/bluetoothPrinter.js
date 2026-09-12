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
  const text = new TextEncoder().encode(receiptText(bill, profile, lang));
  const logo = await logoRaster();
  const prefix = new Uint8Array([0x1b, 0x40, 0x1b, 0x61, 0x01]);
  const suffix = new Uint8Array([0x0a, 0x0a, 0x1d, 0x56, 0x00]);
  const data = new Uint8Array(prefix.length + logo.length + text.length + suffix.length);
  data.set(prefix);
  data.set(logo, prefix.length);
  data.set(text, prefix.length + logo.length);
  data.set(suffix, prefix.length + logo.length + text.length);
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