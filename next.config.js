/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Add support for Web Workers
    config.module.rules.push({
      test: /\.worker\.ts$/,
      use: { loader: 'worker-loader' },
    });
    
    return config;
  },
}

module.exports = nextConfig
