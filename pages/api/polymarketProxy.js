// pages/api/polymarketProxy.js

export default async function handler(req, res) {
  // 允许跨域访问
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // 处理 OPTIONS 预检请求
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 获取查询参数
  const { address } = req.query;
  if (!address) {
    return res.status(400).json({ error: "缺少 address 参数" });
  }

  // 目标 API
  const url = `https://layerhub.xyz/be-api/protocol_wallets/polymarket/${address}`;
  const controller = new AbortController(); // 控制请求
  const timeout = setTimeout(() => controller.abort(), 9000); // 9 秒超时

  // **缓存策略**（减少不必要的 API 请求）
  const cache = new Map();
  if (cache.has(address)) {
    console.log(`[CACHE HIT] ${address}`);
    return res.status(200).json(cache.get(address));
  }

  try {
    console.log(`[FETCH] ${url}`);

    // 发送 API 请求
    const response = await fetch(url, { signal: controller.signal });

    clearTimeout(timeout); // 成功返回，取消超时
    if (!response.ok) {
      return res.status(response.status).json({ error: `第三方 API 请求失败: ${response.statusText}` });
    }

    const data = await response.json();

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
    setTimeout(() => cache.delete(address), 300000); // 5 分钟后清除缓存

    console.log(`[SUCCESS] ${address}`);
    return res.status(200).json(result);

  } catch (error) {
    if (error.name === "AbortError") {
      console.error(`[TIMEOUT] ${address}`);
      return res.status(504).json({ error: "请求超时（API 响应太慢）" });
    }
    console.error(`[ERROR] ${address}:`, error);
    return res.status(500).json({ error: "服务器内部错误" });
  }
}
