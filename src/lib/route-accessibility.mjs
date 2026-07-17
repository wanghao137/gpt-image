export function routeAnnouncement(pathname) {
  if (pathname === "/") return "首页已加载";
  if (pathname === "/cases") return "案例库已加载";
  if (pathname.startsWith("/case/")) return "案例详情已加载";
  if (pathname.startsWith("/category/")) return "案例分类已加载";
  if (pathname === "/templates") return "模板库已加载";
  if (pathname.startsWith("/template/")) return "模板详情已加载";
  if (pathname === "/about") return "关于与使用说明已加载";
  if (pathname === "/sitemap") return "站点地图已加载";
  return "页面已加载";
}
