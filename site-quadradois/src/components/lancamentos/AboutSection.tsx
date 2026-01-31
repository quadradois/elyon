'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, X, Sparkles, Building, CheckCircle } from 'lucide-react';

interface AboutSectionProps {
    description: string;
    videoUrl?: string;
    launchName: string;
    primaryColor: string;
    highlights?: string[];
}

export default function AboutSection({
    description,
    videoUrl,
    launchName,
    primaryColor,
    highlights
}: AboutSectionProps) {
    const [isVideoOpen, setIsVideoOpen] = useState(false);

    // Parse description into paragraphs
    const paragraphs = description.split('\n').filter(p => p.trim());

    // Extract/generate highlights from description if not provided
    const displayHighlights = highlights || extractHighlights(description);

    // Get video embed URL
    const getEmbedUrl = (url: string) => {
        if (url.includes('youtube.com/watch')) {
            return url.replace('watch?v=', 'embed/') + '?autoplay=1';
        }
        if (url.includes('youtu.be/')) {
            const videoId = url.split('youtu.be/')[1]?.split('?')[0];
            return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        }
        if (url.includes('vimeo.com/')) {
            const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
            return `https://player.vimeo.com/video/${videoId}?autoplay=1`;
        }
        return url;
    };

    // Video thumbnail (for YouTube)
    const getVideoThumbnail = (url: string) => {
        // Extract YouTube video ID from various URL formats
        let videoId: string | null = null;

        if (url.includes('youtube.com/watch')) {
            // Format: https://www.youtube.com/watch?v=VIDEO_ID&t=123
            const match = url.match(/[?&]v=([^&]+)/);
            videoId = match ? match[1] : null;
        } else if (url.includes('youtu.be/')) {
            // Format: https://youtu.be/VIDEO_ID?t=123
            const match = url.match(/youtu\.be\/([^?&]+)/);
            videoId = match ? match[1] : null;
        } else if (url.includes('youtube.com/embed/')) {
            // Format: https://www.youtube.com/embed/VIDEO_ID
            const match = url.match(/embed\/([^?&]+)/);
            videoId = match ? match[1] : null;
        }

        if (videoId) {
            // Use hqdefault which is always available (480x360)
            return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
        return null;
    };

    const thumbnail = videoUrl ? getVideoThumbnail(videoUrl) : null;

    return (
        <>
            <section className="relative py-24 overflow-hidden">
                {/* Background */}
                <div className="absolute inset-0">
                    <div className="absolute inset-0 bg-gradient-to-b from-white via-gray-50 to-white" />
                    <div
                        className="absolute top-0 right-0 w-1/2 h-full opacity-5"
                        style={{
                            background: `linear-gradient(135deg, ${primaryColor} 0%, transparent 70%)`
                        }}
                    />
                </div>

                <div className="container-site relative z-10">
                    {/* Header */}
                    <motion.div
                        className="text-center mb-16"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-lg mb-6">
                            <Building className="w-4 h-4" style={{ color: primaryColor }} />
                            <span className="text-sm font-semibold text-gray-700">
                                Conheça o projeto
                            </span>
                        </div>
                        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900">
                            Sobre o{' '}
                            <span style={{ color: primaryColor }}>{launchName}</span>
                        </h2>
                    </motion.div>

                    {/* Content Grid */}
                    <div className={`grid gap-12 items-center ${videoUrl ? 'lg:grid-cols-2' : 'max-w-4xl mx-auto'}`}>
                        {/* Video / Visual Side */}
                        {videoUrl && (
                            <motion.div
                                initial={{ opacity: 0, x: -30 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                className="relative group"
                            >
                                {/* Video Card */}
                                <div
                                    className="relative aspect-video rounded-3xl overflow-hidden shadow-2xl cursor-pointer"
                                    onClick={() => setIsVideoOpen(true)}
                                >
                                    {/* Thumbnail or gradient */}
                                    {thumbnail ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={thumbnail}
                                            alt="Vídeo de apresentação"
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                        />
                                    ) : (
                                        <div
                                            className="w-full h-full"
                                            style={{
                                                background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -40)} 100%)`
                                            }}
                                        />
                                    )}

                                    {/* Overlay */}
                                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />

                                    {/* Play Button */}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <motion.div
                                            className="relative"
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.95 }}
                                        >
                                            {/* Pulse rings */}
                                            <div
                                                className="absolute inset-0 rounded-full animate-ping opacity-30"
                                                style={{ backgroundColor: primaryColor }}
                                            />
                                            <div
                                                className="relative w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center shadow-2xl"
                                                style={{
                                                    background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -30)} 100%)`
                                                }}
                                            >
                                                <Play className="w-8 h-8 md:w-10 md:h-10 text-white ml-1" fill="white" />
                                            </div>
                                        </motion.div>
                                    </div>

                                    {/* Label */}
                                    <div className="absolute bottom-4 left-4 right-4">
                                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-md text-white text-sm font-medium">
                                            <Sparkles className="w-4 h-4" />
                                            Vídeo de Apresentação
                                        </div>
                                    </div>
                                </div>

                                {/* Decorative element */}
                                <div
                                    className="absolute -bottom-4 -right-4 w-2/3 h-2/3 rounded-3xl -z-10 opacity-10"
                                    style={{ background: primaryColor }}
                                />
                            </motion.div>
                        )}

                        {/* Text Side */}
                        <motion.div
                            initial={{ opacity: 0, x: 30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="space-y-6"
                        >
                            {/* Description */}
                            <div className="space-y-4">
                                {paragraphs.slice(0, 3).map((paragraph, index) => (
                                    <p
                                        key={index}
                                        className={`text-gray-600 leading-relaxed ${index === 0 ? 'text-lg font-medium' : ''
                                            }`}
                                    >
                                        {paragraph}
                                    </p>
                                ))}
                            </div>

                            {/* Highlights */}
                            {displayHighlights.length > 0 && (
                                <div className="pt-6 border-t border-gray-200">
                                    <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
                                        Destaques
                                    </h4>
                                    <div className="grid sm:grid-cols-2 gap-3">
                                        {displayHighlights.slice(0, 6).map((highlight, index) => (
                                            <motion.div
                                                key={index}
                                                className="flex items-center gap-3 p-3 rounded-xl bg-white shadow-sm border border-gray-100"
                                                initial={{ opacity: 0, y: 10 }}
                                                whileInView={{ opacity: 1, y: 0 }}
                                                viewport={{ once: true }}
                                                transition={{ delay: 0.1 + index * 0.05 }}
                                            >
                                                <CheckCircle
                                                    className="w-5 h-5 flex-shrink-0"
                                                    style={{ color: primaryColor }}
                                                />
                                                <span className="text-sm font-medium text-gray-700">
                                                    {highlight}
                                                </span>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Video Modal */}
            {isVideoOpen && videoUrl && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
                    onClick={() => setIsVideoOpen(false)}
                >
                    <button
                        onClick={() => setIsVideoOpen(false)}
                        className="absolute top-6 right-6 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    <motion.div
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        className="relative w-full max-w-5xl aspect-video"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <iframe
                            src={getEmbedUrl(videoUrl)}
                            className="w-full h-full rounded-2xl shadow-2xl"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            title="Vídeo de apresentação"
                        />
                    </motion.div>
                </motion.div>
            )}
        </>
    );
}

// Helper to extract highlights from description
function extractHighlights(description: string): string[] {
    const keywords = [
        'localização', 'lazer', 'segurança', 'acabamento', 'vista',
        'piscina', 'academia', 'área gourmet', 'varanda', 'suíte',
        'garagem', 'condomínio', 'infraestrutura', 'sustentável'
    ];

    const highlights: string[] = [];
    const lowerDesc = description.toLowerCase();

    keywords.forEach(keyword => {
        if (lowerDesc.includes(keyword)) {
            highlights.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
        }
    });

    return highlights.slice(0, 6);
}

// Helper to adjust color
function adjustColor(color: string, amount: number): string {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.slice(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.slice(2, 4), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.slice(4, 6), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
