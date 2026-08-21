# 生产环境同域代理

Next.js 前端是唯一对公网开放的服务。`next.config.ts` 中配置了 rewrite：

```ts
async rewrites() {
  return [
    {
      source: "/api/:path*",
      destination: `${process.env.BACKEND_URL || "http://localhost:8080"}/api/:path*`,
    },
  ];
}
```

浏览器只访问前端域名。前端把 `/api/*` 转发给后端，并保留同一个 Session Cookie 路径，因此不需要配置 CORS 或跨域 Cookie。

## 构建期配置

Next.js standalone 构建会评估 rewrite 目标，因此生产镜像必须在构建时传入 `BACKEND_URL`。根目录 `Dockerfile` 的默认值是 `http://127.0.0.1:8080`，Compose 中的 `app` 服务也通过 build arg 传入相同值：

```yaml
build:
  context: .
  args:
    BACKEND_URL: http://127.0.0.1:8080
```

如果你使用自己的构建流程，也需要在 `npm run build` 前设置 `BACKEND_URL` 为同一容器内可达的后端地址。

## 反向代理

建议在前端前面配置 TLS 终止。nginx 示例：

```nginx
server {
  listen 443 ssl http2;
  server_name anki.example.com;

  ssl_certificate /etc/letsencrypt/live/anki.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/anki.example.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

当站点通过 HTTPS 提供服务时，设置 `COOKIE_SECURE=true`。不要把后端端口 `8080` 直接暴露到公网。
