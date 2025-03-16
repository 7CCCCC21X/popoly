export default async function handler(req, res) {
  // 允许跨域访问
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { address } = req.query;
  if (!address) return res.status(400).json({ error: "缺少 address 参数" });

  const url = `https://layerhub.xyz/be-api/protocol_wallets/polymarket/${address}`;

  // **缓存策略**（减少不必要的 API 请求）
  const cache = new Map();
  if (cache.has(address)) {
    console.log(`[CACHE HIT] ${address}`);
    return res.status(200).json(cache.get(address));
  }

  // **重试机制**
  async function fetchWithRetry(url, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000); // 9 秒超时

      try {
        console.log(`[FETCH] ${url} (尝试 ${i + 1}/${retries})`);
        const response = await fetch(url, { signal: controller.signal });

        clearTimeout(timeout); // 取消超时
        if (!response.ok) throw new Error(`HTTP 错误: ${response.status}`);
        return await response.json();
      } catch (error) {
        clearTimeout(timeout);
        if (error.name === "AbortError") {
          console.warn(`[TIMEOUT] ${address} (尝试 ${i + 1}/${retries})`);
        } else {
          console.warn(`[ERROR] ${address} (尝试 ${i + 1}/${retries}):`, error.message);
        }

        if (i < retries - 1) await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
    throw new Error("API 请求超时，重试失败");
  }

  try {
    const data = await fetchWithRetry(url, 3, 1000); // **最多重试 3 次**

    // 解析交易次数
    let transactionCount = 0;
    if (Array.isArray(data?.cardsList?.[0]?.data?.stats)) {
      const transactionStat = data.cardsList[0].data.stats.find(stat => stat.sortingKey === "transaction_count");
      transactionCount = transactionStat?.value || 0;
    }

    // 获取活跃天数
    const activeDays = data?.widget?.data?.activeDays?.value || 0;

    // 获取排名百分比
    const topPercent = data?.walletPerformance?.topPercent || 0;

    // 获取最后活跃时间
    const lastUseStr = data?.widget?.data?.lastUse || "";
    let daysAgo = "未知";
    if (lastUseStr) {
      const lastUseDate = new Date(lastUseStr);
      if (!isNaN(lastUseDate.getTime())) {
        const today = new Date();
        const diffTime = today - lastUseDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        daysAgo = `${diffDays} 天前`;
      }
    }

    // 结果数据
    const result = {
      address,
      transaction_count: transactionCount,
      active_days: activeDays,
      top_percent: topPercent.toFixed(2),
      last_use: lastUseStr,
      days_ago: daysAgo,
    };

    // **缓存 5 分钟**
    cache.set(address, result);
    setTimeout(() => cache.delete(address), 300000);

    console.log(`[SUCCESS] ${address}`);
    return res.status(200).json(result);

  } catch (error) {
    console.error(`[FINAL ERROR] ${address}:`, error.message);
    return res.status(504).json({ error: "查询超时或服务器错误，请稍后重试" });
  }
}
