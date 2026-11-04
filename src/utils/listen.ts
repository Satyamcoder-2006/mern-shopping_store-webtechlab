import type { Server } from 'node:http';

export async function listenOnAvailablePort(server: Server, preferredPort: number, attempts = 10) {
  for (let offset = 0; offset < attempts; offset++) {
    const port = preferredPort + offset;
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: NodeJS.ErrnoException) => {
          server.removeListener('listening', onListening);
          reject(error);
        };
        const onListening = () => {
          server.removeListener('error', onError);
          resolve();
        };
        server.once('error', onError);
        server.once('listening', onListening);
        try {
          server.listen(port, '0.0.0.0');
        } catch (error) {
          server.removeListener('error', onError);
          server.removeListener('listening', onListening);
          reject(error);
        }
      });
      return (server.address() as { port: number }).port;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error;
      if (offset === attempts - 1) {
        throw new Error(`Ports ${preferredPort}-${port} are occupied. Set PORT in .env to a free port.`);
      }
      console.log(`Port ${port} is in use; trying ${port + 1}.`);
    }
  }
  throw new Error('At least one port attempt is required.');
}
