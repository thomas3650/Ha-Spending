export const INGRESS_ADDRESS = "172.30.32.2";

const ALLOWED = new Set([INGRESS_ADDRESS, `::ffff:${INGRESS_ADDRESS}`]);

export function isIngress(address: string | undefined): boolean {
  return address !== undefined && ALLOWED.has(address);
}
