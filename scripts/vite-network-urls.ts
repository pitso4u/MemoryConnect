import type { Plugin } from 'vite';
import os from 'node:os';

export function networkUrlsPlugin(label: string, port: number): Plugin {
  return {
    name: 'memorialconnect-network-urls',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const addresses: string[] = [];
        for (const iface of Object.values(os.networkInterfaces())) {
          for (const addr of iface ?? []) {
            if (addr.family === 'IPv4' && !addr.internal) {
              addresses.push(addr.address);
            }
          }
        }

        const apiPort = process.env.VITE_API_PORT || process.env.PORT || '4000';
        console.log(`\n  MemorialConnect ${label}`);
        console.log(`  ➜  Local:   http://localhost:${port}/`);
        for (const ip of addresses) {
          console.log(`  ➜  Network: http://${ip}:${port}/`);
        }
        console.log(`  ➜  Backend: http://localhost:${apiPort} (network: http://<your-ip>:${apiPort})`);
        console.log('');
      });
    },
  };
}
