# uniCloud 歌单后端

服务空间：jiuju-songlist（阿里云）。`songlist-api` 处理正式共享数据，原 `songlist-test` 保留用于测试。

网页使用 `public/community-bridge` 中的 HBuilderX 生产构建，通过同源 iframe 和官方 `uniCloud.callFunction` 调用云函数，不依赖本地运行中的 HBuilderX。

## 部署

1. 将 `songlist-api` 复制到已绑定服务空间的 uniCloud-aliyun/cloudfunctions 下并上传。
2. 上传 database 下的 schema，包括新增的 `songlist_requests.schema.json`。客户端直接读写均关闭，数据由云函数校验后操作。
3. bridge-source 中保留连接页及构建配置。用 HBuilderX 发布 Web，复制生成目录到 public/community-bridge。
4. `node --test integrations/unicloud/api.test.cjs`
5. `npx vite build --config vite.pages.config.ts`

默认使用 uniCloud；设置 `VITE_COMMUNITY_PROVIDER=cloudflare` 可切回旧服务。旧服务数据未删除，也未自动迁移；两套数据库独立。本机收藏仍可在登录时合并。

## 范围

延续原有免密 ID 档案行为：知道相同 ID 的人能操作同一收藏，不适合存放私密资料。点歌事件 ID 防重复，收藏和统计通过事务同步。待播单仅在观众查看时每 30 秒刷新，主播登录后台时每 15 秒刷新；页面隐藏后暂停轮询。免费套餐仍受服务商每日读写额度限制。

点放自动播放另需在主播电脑运行 `tools/netease-helper`。云端请求不会直接操作观众设备。

歌单外自由点歌复用 `submitRequest`：歌单歌曲继续传编号 `song`；自由点歌传歌名 `title` 和 `kind`，不写入歌曲目录。`songlist_requests` 的 `songId` 对自由请求可省略，先覆盖上传相应 schema，再覆盖上传 `songlist-api` 云函数。自动续播按歌名调用本机助手，点唱请求等候主播处理。

当前聚合许愿列表上限 200 项，避免单文档无限增长；需要扩大时应改为分页集合。历史点歌事件保留用于去重。数据库测试使用独立的“连接验证0914”档案。
