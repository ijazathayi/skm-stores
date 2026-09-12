import { getProductName } from './translations';

const encoder = new TextEncoder();
const printerServiceUuids = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
];

function receiptText(bill, profile = {}) {
  const width = 32;
  const line = '-'.repeat(width);
  const storeName = profile.storeName || 'SKM STORES';
  const rows = (bill.items || []).map((item, index) => {
    const name = getProductName(item, 'en').slice(0, 18);
    const amount = ((Number(item.qty) || 0) * (Number(item.price) || 0)).toFixed(2);
    return `${String(index + 1).padEnd(2)} ${name.padEnd(18)} ${amount.padStart(8)}`;
  });

  return [
    '\x1b\x40', '\x1b\x61\x01', storeName, '\n',
    'RETAIL INVOICE', `Bill No: #${bill.billNo || ''}`,
    new Date(bill.timestamp || Date.now()).toLocaleString('en-GB'),
    '\x1b\x61\x00', line, '#  ITEM                 TOTAL', ...rows,
    line, `TOTAL:                  Rs.${Number(bill.total || 0).toFixed(2)}`,
    '\x1b\x61\x01', profile.receiptFooter || 'THANK YOU VISIT AGAIN', '\n\n\n',
    '\x1d\x56\x00',
  ].join('\n');
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
  const data = encoder.encode(receiptText(bill, profile));
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