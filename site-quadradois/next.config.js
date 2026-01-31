/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**.amazonaws.com',
            },
            {
                protocol: 'https',
                hostname: '**.cloudfront.net',
            },
            {
                protocol: 'https',
                hostname: 'images.unsplash.com',
            },
            {
                protocol: 'https',
                hostname: 'via.placeholder.com',
            },
            {
                protocol: 'https',
                hostname: 'resizedimgs.vivareal.com',
            },
        ],
    },
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: 'https://api.quadradois.com.br/api/:path*',
            },
        ];
    },
}

module.exports = nextConfig
