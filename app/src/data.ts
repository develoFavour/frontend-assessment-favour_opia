export type Status = 'NEW' | 'PICKING' | 'SHIPPED' | 'CANCELLED';

export interface Order {
  id: string;
  customer: string;
  status: Status;
  total: number;
  date: string;
}

const STATUSES: Status[] = ['NEW', 'PICKING', 'SHIPPED', 'CANCELLED'];
const NAMES = ['Alice Smith', 'Bob Jones', 'Charlie Brown', 'Diana Prince', 'Eve Adams', 'Frank Castle', 'Grace Hopper', 'Hank Pym'];

// Seeded PRNG for stable random data
function sfc32(a: number, b: number, c: number, d: number) {
  return function () {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = (c << 21 | c >>> 11);
    d = d + 1 | 0;
    t = t + d | 0;
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  }
}
const rand = sfc32(1, 2, 3, 4);

export const generateOrders = (count = 5000): Order[] => {
  const orders: Order[] = [];
  for (let i = 1; i <= count; i++) {
    const r1 = rand();
    const r2 = rand();
    const r3 = rand();
    const r4 = rand();

    orders.push({
      id: `ORD-${String(i).padStart(5, '0')}`,
      customer: NAMES[Math.floor(r1 * NAMES.length)] + ` (ID: ${Math.floor(r2 * 1000)})`,
      status: STATUSES[Math.floor(r3 * STATUSES.length)],
      total: Number((r4 * 1000 + 10).toFixed(2)),
      date: new Date(Date.now() - Math.floor(rand() * 10000000000)).toISOString()
    });
  }
  return orders;
};
