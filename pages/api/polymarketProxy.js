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

  const url = `https://layerhub.xyz/be-api/protocol_wallets/polymarket/${address}`;

  try {
    // 请求第三方接口
    const response = await fetch(url);
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

    // 返回最终数据
    return res.status(200).json({
      address,
      transaction_count: transactionCount,
      active_days: activeDays,
      top_percent: topPercent.toFixed(2), // 确保保留两位小数
      last_use: lastUseStr,
      days_ago: daysAgo,
    });

  } catch (error) {
    console.error("API 请求出错:", error);
    return res.status(500).json({ error: "服务器内部错误" });
  }
}
