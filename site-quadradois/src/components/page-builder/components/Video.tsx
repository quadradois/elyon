/**
 * Video Component
 */
import { ComponentProps } from '../types';

export default function Video(props: ComponentProps) {
    const {
        url,
        title,
        autoplay = false
    } = props;

    if (!url) return null;

    // Helper to extract embed ID
    const getEmbedUrl = (videoUrl: string) => {
        if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
            const id = videoUrl.includes('v=')
                ? videoUrl.split('v=')[1].split('&')[0]
                : videoUrl.split('/').pop();
            return `https://www.youtube.com/embed/${id}?autoplay=${autoplay ? 1 : 0}`;
        }
        if (videoUrl.includes('vimeo.com')) {
            const id = videoUrl.split('/').pop();
            return `https://player.vimeo.com/video/${id}?autoplay=${autoplay ? 1 : 0}`;
        }
        return videoUrl; // assume valid if direct or unknown
    };

    const embedUrl = getEmbedUrl(url);

    return (
        <section className="py-12 bg-gray-50">
            <div className="container mx-auto px-4 text-center">
                {title && (
                    <h2 className="text-2xl md:text-3xl font-bold mb-8">{title}</h2>
                )}
                <div className="max-w-4xl mx-auto aspect-video rounded-xl overflow-hidden shadow-lg bg-black">
                    <iframe
                        src={embedUrl}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={title || 'Video'}
                    />
                </div>
            </div>
        </section>
    );
}
