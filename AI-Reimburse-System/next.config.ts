import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 添加这行，指定输出目录
  distDir: '.next',
  // 如果项目在子目录下，可能需要这个
  basePath: '',
  // 确保静态资源路径正确
  trailingSlash: false,
};

export default nextConfig;