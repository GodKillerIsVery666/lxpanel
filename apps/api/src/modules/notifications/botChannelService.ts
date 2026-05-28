/**
 * 钉钉/企微/飞书 Webhook 通知渠道。
 * 支持发送 Markdown 消息到群机器人。
 */

interface BotWebhookConfig {
  url: string;
  secret?: string; // 签名密钥（钉钉 v2 及以上）
}

const defaultSender = async (url: string, payload: unknown): Promise<{ ok: boolean; status: number; body: string }> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    return { ok: response.ok, status: response.status, body: await response.text() };
  } finally {
    clearTimeout(timer);
  }
};

/**
 * 发送钉钉群机器人消息。
 */
export async function sendDingTalkMessage(config: BotWebhookConfig, title: string, content: string): Promise<{ ok: boolean; error?: string }> {
  try {
    let url = config.url;
    if (config.secret) {
      const timestamp = Date.now();
      const { createHmac } = await import("node:crypto");
      const sign = createHmac("sha256", config.secret)
        .update(`${timestamp}\n${config.secret}`)
        .digest("base64");
      url += `&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
    }
    const result = await defaultSender(url, {
      msgtype: "markdown",
      markdown: { title, text: content }
    });
    return { ok: result.ok, ...(result.ok ? {} : { error: `HTTP ${result.status}: ${result.body.slice(0, 200)}` }) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 发送企业微信群机器人消息。
 */
export async function sendWeChatMessage(config: BotWebhookConfig, title: string, content: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await defaultSender(config.url, {
      msgtype: "markdown",
      markdown: { content: `## ${title}\n${content}` }
    });
    return { ok: result.ok, ...(result.ok ? {} : { error: `HTTP ${result.status}: ${result.body.slice(0, 200)}` }) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 发送飞书群机器人消息。
 */
export async function sendFeishuMessage(config: BotWebhookConfig, title: string, content: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await defaultSender(config.url, {
      msg_type: "interactive",
      card: {
        header: { title: { tag: "plain_text", content: title } },
        elements: [{ tag: "markdown", content }]
      }
    });
    return { ok: result.ok, ...(result.ok ? {} : { error: `HTTP ${result.status}: ${result.body.slice(0, 200)}` }) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 根据渠道类型路由到对应的 bot 发送函数。
 */
export async function sendBotMessage(type: "dingtalk" | "wechat" | "feishu", config: BotWebhookConfig, title: string, content: string): Promise<{ ok: boolean; error?: string }> {
  switch (type) {
    case "dingtalk":
      return sendDingTalkMessage(config, title, content);
    case "wechat":
      return sendWeChatMessage(config, title, content);
    case "feishu":
      return sendFeishuMessage(config, title, content);
    default:
      return { ok: false, error: `不支持的通知渠道类型: ${type}` };
  }
}
