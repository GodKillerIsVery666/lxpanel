# 连接器配置

## 安装连接器

在受管服务器上运行：

```bash
# 使用面板生成的安装命令
# 或在面板平台治理页复制连接器令牌和命令
node lxpanel-connector.mjs --token <your-token> --server http://panel:7080
```

## 自动注册

连接器启动后会自动向面板注册，面板会将未绑定的连接器展示为「发现主机」。

## 命令签名

面板下发命令会附带 HMAC-SHA256 签名，连接器领取后验签执行，回传结果同样签名。

## Docker 部署连接器

```bash
docker compose -f deploy/docker-compose.connector.yml up -d
```
