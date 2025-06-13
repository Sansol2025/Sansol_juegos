import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    // Set to false for production builds
    ignoreBuildErrors: false,
  },
  eslint: {
    // Set to false for production builds
    ignoreDuringBuilds: false,
  },
  webpack: (
    config,
    { isServer, nextRuntime, webpack }
  ) => {
    if (isServer && nextRuntime === "nodejs") {
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^(?:@google-cloud\/functions-framework|@opentelemetry\/exporter-jaeger|@opentelemetry\/propagator-gcp|@opentelemetry\/sdk-trace-gcp|firebase-functions|handlebars|undici)$/
        })
      );
    }
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.qrserver.com',
        port: '',
        pathname: '/v1/create-qr-code/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.google.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'encrypted-tbn0.gstatic.com',
        port: '',
        pathname: '/**',
      },
       {
        protocol: 'https',
        hostname: 'previews.123rf.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.tustecnologiastuc.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;
