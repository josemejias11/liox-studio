export class RateLimiter {
  private timestamps: Map<string, number[]> = new Map();

  constructor(private maxRequests: number, private windowMs: number) {}

  check(ip: string): boolean {
    const now = Date.now();
    const timestamps = this.timestamps.get(ip) ?? [];
    
    // Remove expired timestamps
    const validTimestamps = timestamps.filter((t) => now - t < this.windowMs);
    
    if (validTimestamps.length >= this.maxRequests) {
      this.timestamps.set(ip, validTimestamps);
      return false;
    }
    
    validTimestamps.push(now);
    this.timestamps.set(ip, validTimestamps);
    return true;
  }
}
