import os from 'os';

export function getNetworkIPv4Addresses(): string[] {
  const addresses: string[] = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const addr of iface ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) {
        addresses.push(addr.address);
      }
    }
  }
  return addresses;
}

export function printServerUrls(service: string, port: number, path = '') {
  const suffix = path ? `/${path.replace(/^\//, '')}` : '';
  console.log(`\n  Memory Connect ${service}`);
  console.log(`  ➜  Local:   http://localhost:${port}${suffix}`);
  for (const ip of getNetworkIPv4Addresses()) {
    console.log(`  ➜  Network: http://${ip}:${port}${suffix}`);
  }
  console.log('');
}
