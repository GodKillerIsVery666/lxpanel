import { createConnection } from "node:net";
import { connect } from "node:tls";
import type { Socket } from "node:net";

/**
 * 简易 SMTP 邮件发送服务，使用 Node.js 内置 net/tls 模块。
 * 支持 STARTTLS (端口 587) 和直连 TLS (端口 465)。
 */
export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from: string;
}

export interface SmtpSendResult {
  ok: boolean;
  error?: string;
}

function readLine(socket: Socket): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = (chunk: Buffer): void => {
      buffer += chunk.toString("utf8");
      const idx = buffer.indexOf("\r\n");
      if (idx !== -1) {
        socket.removeListener("data", onData);
        resolve(buffer.slice(0, idx));
      }
    };
    socket.on("data", onData);
    socket.on("error", reject);
    socket.on("close", () => reject(new Error("连接关闭")));
  });
}

function writeLine(socket: Socket, line: string): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.write(`${line}\r\n`, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

async function expectCode(socket: Socket, expected: number): Promise<string> {
  const line = await readLine(socket);
  const code = Number.parseInt(line.slice(0, 3), 10);
  if (code !== expected) {
    throw new Error(`SMTP 错误: 期望 ${expected}，收到 ${code} - ${line}`);
  }
  return line;
}

export async function sendSmtpEmail(config: SmtpConfig, to: string, subject: string, body: string): Promise<SmtpSendResult> {
  let socket: Socket | null = null;
  try {
    // 连接
    const raw = createConnection(config.port, config.host);
    socket = config.secure ? connect({ socket: raw, servername: config.host, host: config.host, port: config.port }) : raw;

    await new Promise<void>((resolve, reject) => {
      socket!.on("connect", () => resolve());
      socket!.on("error", reject);
    });

    await expectCode(socket, 220);

    // EHLO
    await writeLine(socket, `EHLO lxpanel`);
    const ehloResponse = await readLine(socket);
    const ehloCode = Number.parseInt(ehloResponse.slice(0, 3), 10);
    if (ehloCode !== 250) {
      throw new Error(`EHLO 失败: ${ehloResponse}`);
    }
    // 读取剩余 EHLO 响应行
    while (true) {
      const line = await readLine(socket);
      if (line[3] !== "-") {
        break;
      }
    }

    // STARTTLS (非直连 TLS 时)
    if (!config.secure && config.port === 587) {
      await writeLine(socket, "STARTTLS");
      await expectCode(socket, 220);
      const tlsSocket = connect({ socket, servername: config.host, host: config.host, port: config.port });
      socket = tlsSocket;
      await new Promise<void>((resolve, reject) => {
        tlsSocket.on("secureConnect", () => resolve());
        tlsSocket.on("error", reject);
      });
      await writeLine(socket, `EHLO lxpanel`);
      const tlsEhlo = await readLine(socket);
      if (Number.parseInt(tlsEhlo.slice(0, 3), 10) !== 250) {
        throw new Error(`TLS EHLO 失败: ${tlsEhlo}`);
      }
      while (true) {
        const line = await readLine(socket);
        if (line[3] !== "-") {
          break;
        }
      }
    }

    // AUTH LOGIN
    await writeLine(socket, "AUTH LOGIN");
    await expectCode(socket, 334);
    await writeLine(socket, Buffer.from(config.username).toString("base64"));
    await expectCode(socket, 334);
    await writeLine(socket, Buffer.from(config.password).toString("base64"));
    await expectCode(socket, 235);

    // MAIL FROM
    await writeLine(socket, `MAIL FROM:<${config.from}>`);
    await expectCode(socket, 250);

    // RCPT TO
    await writeLine(socket, `RCPT TO:<${to}>`);
    await expectCode(socket, 250);

    // DATA
    await writeLine(socket, "DATA");
    await expectCode(socket, 354);

    const headers = [
      `From: ${config.from}`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(body, "utf8").toString("base64")
    ].join("\r\n");

    await writeLine(socket, headers);
    await writeLine(socket, ".");
    await expectCode(socket, 250);

    // QUIT
    await writeLine(socket, "QUIT");
    await expectCode(socket, 221);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    if (socket) {
      try { socket.end(); } catch { /* ignore */ }
    }
  }
}
