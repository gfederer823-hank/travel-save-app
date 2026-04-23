export default async function handler(req: any, res: any) {
  try {
    const method = req?.method ?? "POST";

    if (method !== "POST") {
      if (res) {
        return res.status(405).json({ error: "Method not allowed" });
      }
      return;
    }

    let body: any = {};

    if (req?.body) {
      body = req.body;
    } else if (typeof req?.json === "function") {
      body = await req.json();
    }

    const videoUrl = String(body.videoUrl || "").trim();

    console.log("API 被呼叫了！");
    console.log("收到的 videoUrl:", videoUrl);

    if (!videoUrl) {
      return res.status(400).json({ error: "缺少影片網址" });
    }

    const youtubeApiKey = process.env.YOUTUBE_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!youtubeApiKey) {
      return res.status(500).json({ error: "缺少 YOUTUBE_API_KEY" });
    }

    if (!openaiApiKey) {
      return res.status(500).json({ error: "缺少 OPENAI_API_KEY" });
    }

    // 1. 從網址抓 videoId
    let videoId = "";

    if (videoUrl.includes("youtube.com/shorts/")) {
      videoId = videoUrl.split("shorts/")[1]?.split("?")[0] || "";
    } else if (videoUrl.includes("youtu.be/")) {
      videoId = videoUrl.split("youtu.be/")[1]?.split("?")[0] || "";
    }

    console.log("解析出的 videoId:", videoId);

    if (!videoId) {
      return res.status(200).json({
        places: [],
        error: "無法解析 YouTube 影片 ID",
      });
    }

    // 2. 用 YouTube API 抓影片資訊
    const youtubeRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${youtubeApiKey}`
    );

    const youtubeData = await youtubeRes.json();
    console.log("YouTube API 回傳:", JSON.stringify(youtubeData, null, 2));

    const item = youtubeData.items?.[0];
    const videoTitle = item?.snippet?.title || "";
    const videoDescription = item?.snippet?.description || "";

    console.log("影片標題:", videoTitle);
    console.log("影片描述:", videoDescription);

    if (!videoTitle && !videoDescription) {
      return res.status(200).json({
        places: [],
        error: "抓不到影片標題與描述",
      });
    }

    // 3. 丟給 OpenAI 分析地點
    const prompt = `
你是一個旅遊地點分析助手。

以下是 YouTube Shorts 的資訊：

影片標題：
${videoTitle}

影片描述：
${videoDescription}

請從影片標題與描述中，找出影片最可能出現的「可實際查詢地址的地點名稱」。

請特別注意：
1. 如果是店家，盡量保留城市或區域資訊，例如「台北市 東引小吃店」
2. 如果影片文字已經指出在台北，不要只回「東引小吃店」，要回更完整的名稱
3. 如果有分店可能，請優先回傳最具辨識性的完整名稱
4. 不要回傳太籠統的詞，例如「台北」、「夜市」、「美食」
5. 請只回傳適合拿去地圖查詢的地點名稱
6. 最多回傳 3 個

請只回傳 JSON，格式如下：
{
  "places": ["地點1", "地點2", "地點3"]
}
`;

    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt,
      }),
    });

    const openaiData = await openaiRes.json();
    console.log("OpenAI 原始回傳:", JSON.stringify(openaiData, null, 2));

    const text =
      openaiData.output?.[0]?.content?.[0]?.text || '{"places": []}';

    try {
      const parsed = JSON.parse(text);
      return res.status(200).json(parsed);
    } catch (error) {
      console.log("JSON parse 失敗，text =", text);
      return res.status(200).json({ places: [] });
    }
  } catch (error) {
    console.log("analyze error:", error);
    return res.status(500).json({ error: "伺服器錯誤" });
  }
}