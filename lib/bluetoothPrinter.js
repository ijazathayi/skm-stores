import html2canvas from 'html2canvas';
import { getReceiptHTML } from './printReceipt';

const printerServiceUuids = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
];

function canvasToRaster(canvas) {
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
    0x1b, 0x40, 0x1d, 0x76, 0x30, 0x00,
    bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff,
    height & 0xff, (height >> 8) & 0xff,
  ]);
  const footer = new Uint8Array([0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x00]);
  const output = new Uint8Array(header.length + raster.length + footer.length);
  output.set(header);
  output.set(raster, header.length);
  output.set(footer, header.length + raster.length);
  return output;
}

async function receiptImage(bill, profile = {}) {
  const container = document.createElement('div');
  container.innerHTML = getReceiptHTML(bill, profile, {
    width: 58,
    lang: profile.printLang || localStorage.getItem('skm_lang') || 'en',
  });
  container.style.cssText = 'position:fixed;left:-10000px;top:0;width:384px;background:#fff;';
  const body = container.querySelector('body');
  body.style.width = '384px';
  body.style.maxWidth = '384px';
  body.style.padding = '8px 10px';
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(body, { backgroundColor: '#fff', scale: 1, width: 384 });
    return canvasToRaster(canvas);
  } finally {
    container.remove();
  }
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

export async function printReceiptBluetooth(bill, profile = {}) {
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
  const data = await receiptImage(bill, profile);
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