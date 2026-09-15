/**
 * V1.00 R5 并发压测引擎
 *
 * 在单进程中模拟并发请求，收集延迟、吞吐量、错误率。
 * 不依赖实际 HTTP 服务器——直接调用内部函数进行压测。
 */

interface StressTestConfig {
  concurrency: number;     // 并发数
  totalRequests: number;   // 总请求数
  timeoutMs: number;       // 单请求超时
}

interface StressTestResult {
  totalRequests: number;
  completed: number;
  failed: number;
  timedOut: number;
  totalTimeMs: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  throughputPerSec: number;
  errors: { message: string; count: number }[];
}

/**
 * 执行压测
 * @param taskFactory 每次调用返回一个异步任务（模拟一个 HTTP 请求）
 */
export async function runStressTest(
  config: StressTestConfig,
  taskFactory: (index: number) => Promise<{ success: boolean; error?: string }>
): Promise<StressTestResult> {
  const latencies: number[] = [];
  const errors: Map<string, number> = new Map();
  let completed = 0, failed = 0, timedOut = 0;
  const startTime = Date.now();

  // 分批执行并发请求
  const batches = Math.ceil(config.totalRequests / config.concurrency);

  for (let batch = 0; batch < batches; batch++) {
    const batchStart = (batch + 1) * config.concurrency > config.totalRequests
      ? config.totalRequests - batch * config.concurrency
      : config.concurrency;

    const tasks: Promise<void>[] = [];

    for (let i = 0; i < batchStart; i++) {
      const index = batch * config.concurrency + i;
      const taskStart = Date.now();

      const p = Promise.race([
        taskFactory(index),
        new Promise<{ success: boolean; error?: string }>((_, reject) =>
          setTimeout(() => reject(new Error("TIMEOUT")), config.timeoutMs)
        ),
      ]).then(r => {
        const latency = Date.now() - taskStart;
        latencies.push(latency);

        if (r.success) {
          completed++;
        } else {
          failed++;
          const msg = r.error || "unknown";
          errors.set(msg, (errors.get(msg) || 0) + 1);
        }
      }).catch((err: Error) => {
        if (err.message === "TIMEOUT") {
          timedOut++;
          errors.set("TIMEOUT", (errors.get("TIMEOUT") || 0) + 1);
        } else {
          failed++;
          const msg = err.message;
          errors.set(msg, (errors.get(msg) || 0) + 1);
        }
      });

      tasks.push(p);
    }

    await Promise.all(tasks);
  }

  const totalTimeMs = Date.now() - startTime;
  latencies.sort((a, b) => a - b);

  const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const avgLatency = latencies.length > 0
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : 0;

  return {
    totalRequests: config.totalRequests,
    completed,
    failed,
    timedOut,
    totalTimeMs,
    avgLatencyMs: avgLatency,
    p50LatencyMs: p50,
    p95LatencyMs: p95,
    p99LatencyMs: p99,
    throughputPerSec: Math.round((completed / totalTimeMs) * 1000),
    errors: Array.from(errors.entries()).map(([message, count]) => ({ message, count })),
  };
}

/**
 * 格式化压测报告
 */
export function formatStressReport(result: StressTestResult): string {
  const successRate = ((result.completed / result.totalRequests) * 100).toFixed(2);
  return [
    `═══════════════════════════════════════`,
    `  并发压测报告`,
    `═══════════════════════════════════════`,
    `  总请求:    ${result.totalRequests}`,
    `  成功:      ${result.completed} (${successRate}%)`,
    `  失败:      ${result.failed}`,
    `  超时:      ${result.timedOut}`,
    `  总耗时:    ${result.totalTimeMs}ms`,
    `  吞吐量:    ${result.throughputPerSec} req/s`,
    `  平均延迟:  ${result.avgLatencyMs}ms`,
    `  P50 延迟:  ${result.p50LatencyMs}ms`,
    `  P95 延迟:  ${result.p95LatencyMs}ms`,
    `  P99 延迟:  ${result.p99LatencyMs}ms`,
    `───────────────────────────────────────`,
    `  错误分布:`,
    ...result.errors.map(e => `    ${e.message}: ${e.count} 次`),
    `═══════════════════════════════════════`,
  ].join("\n");
}
