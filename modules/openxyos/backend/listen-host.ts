/**
 * Listen address for the organization process.
 *
 * The default is loopback. Inherited HOST is ignored so a parent 0.0.0.0
 * cannot expose the process. LAN, NAS, and Docker exposure require the
 * explicit FREEOS_ORG_BIND_HOST opt-in.
 *
 * Docker compose publishes 127.0.0.1:host:container and may set
 * FREEOS_ORG_BIND_HOST=0.0.0.0 so the process is reachable from the container
 * proxy without opening the host LAN. Host-network compose has no published
 * port, so the process itself stays on 127.0.0.1 unless the operator opts in.
 */
export function resolveListenHost(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = (env.FREEOS_ORG_BIND_HOST || "").trim();
  return explicit || "127.0.0.1";
}
