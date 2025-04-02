/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Add support for Web Workers
    config.module.rules.push({
      test: /\.worker\.ts$/,
      use: { loader: 'worker-loader' },
    });
    
    // Handle canvas dependency for client-side rendering
    if (!isServer) {
      // Replace canvas module with a no-op module
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        'canvas.node': false,
      };
    }
    
    return config;
  },
  // Disable server-side rendering for components that use canvas
  // This ensures the canvas code only runs on the client
  reactStrictMode: true,
}

module.exports = nextConfig
