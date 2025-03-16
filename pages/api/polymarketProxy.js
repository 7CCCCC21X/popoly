// pages/api/polymarketProxy.js
export default async function handler(req, res) {
  // 允许跨域，方便你在其他站点也可以访问
  res.setHeader("Access-Control-Allow-Origin", "*");
  
  // 如果还有其他方法或头部需要，可以继续设置
  // res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  // res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  const { address } = req.query;

  if (!address) {
    return res.status(400).json({ error: "Missing address parameter" });
  }

  const url = `https://layerhub.xyz/be-api/protocol_wallets/polymarket/${address}`;

  try {
    // 服务端去请求第三方接口
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: "Third-party request failed" });
    }
    const data = await response.json();

    // 解析数据并返回给前端
    let transactionCount = 0;
    const stats = data?.cardsList?.[0]?.data?.stats ?? [];
    for (const stat of stats) {
      if (stat.sortingKey === "transaction_count") {
        transactionCount = stat.value || 0;
        break;
      }
    }

    // 活跃天数
    const activeDays = data?.widget?.data?.activeDays?.value || 0;
    // 排名百分比
    const topPercent = data?.walletPerformance?.topPercent || 0;
    // 最后活跃时间
    const lastUseStr = data?.widget?.data?.lastUse || "";
    let daysAgo = "";
    if (lastUseStr) {
      const lastUseDate = new Date(lastUseStr);
      if (!isNaN(lastUseDate)) {
        const today = new Date();
        const diffTime = today - lastUseDate; // 毫秒差
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        daysAgo = `${diffDays} 天前`;
      }
    }

    return res.status(200).json({
      address,
      transaction_count: transactionCount,
      active_days: activeDays,
      top_percent: topPercent,
      last_use: lastUseStr,
      days_ago: daysAgo,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
