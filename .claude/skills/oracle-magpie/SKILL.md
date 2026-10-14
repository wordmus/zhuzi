---
name: oracle-magpie
description: "Use the always-on Magpie on the Oracle Cloud Always Free VM in Singapore. Use when the user asks to open Magpie, check the gateway, SSH the free VM, or expose port 3425."
user-invocable: true
---

# Oracle 上的 Magpie

新加坡 Always Free 小机上的 yetone/magpie，给本机当常开网关用。密钥只在本机文件里，不要抄进聊天、提交记录或这个 skill。

## 在哪

- 公网 IP：`161.118.228.76`
- SSH：`ssh -i ~/.ssh/id_rsa ubuntu@161.118.228.76`
- 机型：`VM.Standard.E2.1.Micro`（约 1GB 内存，已有 2GB swap）。不要再往这台机器上堆别的服务，也不要在上面编译。
- 实例显示名：`magpie`
- 实例 OCID：`ocid1.instance.oc1.ap-singapore-1.anzwsljrvbj6qvach4aamqjb5breywq6xinawi372h46rmnokeyjifgcvbua`
- 本机记录：`~/magpie-oracle/env.sh`（租户、子网、实例、IP）
- 本机入口和密钥：`~/magpie-oracle/access.txt`（`WEB_URL`、`WEB_KEY`、`GATEWAY_URL`）。虚拟机上同一份在 `/home/ubuntu/magpie-access.txt`，权限 600。

Home region 锁在 `ap-singapore-1`，不能再订别的区域。不要再跑 `~/magpie-oracle/retry-launch.sh`，否则会再开一台实例。

## 怎么用

网页：打开 `access.txt` 里的 `WEB_URL`（带 `?k=`）。Magpie 跑在宿主机上，不是容器里，systemd 服务名 `magpie`，二进制 `~/.local/bin/magpie`，配置 `~/.config/magpie`。这样 `magpie ls` 能看见这台机器上的 agent。给某个 agent 指定模型用 `magpie <名字> <provider/model>`，它会自己改那个 agent 的配置。

```bash
ssh -i ~/.ssh/id_rsa ubuntu@161.118.228.76 'systemctl is-active magpie'
```

网关已经对公网开放：`http://161.118.228.76:3425/v1`。不带密钥返回 401，`Authorization: Bearer` 用 `access.txt` 里的 `GATEWAY_KEY` 才返回 200。本机回环不校验密钥，公网必须校验。每天 04:17 UTC 左右 `magpie-update.timer` 会检查更新，有新版本才重启。旧的 Docker 容器已停，不要再 `docker start magpie`，否则会抢端口。

账号登录（Codex 等）走网页或 `docker exec -it magpie /magpie accounts add codex`。OAuth 回调回到使用者自己的 localhost，不回到容器。

OCI CLI 在本机，profile `DEFAULT`，`OCI_CLI_AUTH=security_token`，区域 `ap-singapore-1`。会话大约一小时过期。重新登录必须让 `oci session authenticate --region ap-singapore-1` 脱离当前 shell 活着，并听着 `localhost:8181`，否则浏览器会连不上。

阿里云 `ali`（`8.134.13.73`，root）是备用机，这套部署没用它。
