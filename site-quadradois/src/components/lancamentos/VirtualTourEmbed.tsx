interface VirtualTourEmbedProps {
    tourUrl?: string;
    title?: string;
}

export default function VirtualTourEmbed({ tourUrl, title = 'Tour Virtual 360°' }: VirtualTourEmbedProps) {
    if (!tourUrl) return null;

    return (
        <section className="py-16 md:py-24 bg-white">
            <div className="container-site">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
                    {title}
                </h2>
                <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl" style={{ paddingBottom: '56.25%' }}>
                    <iframe
                        src={tourUrl}
                        className="absolute inset-0 w-full h-full"
                        allow="fullscreen; vr; xr-spatial-tracking"
                        allowFullScreen
                        title={title}
                    />
                </div>
            </div>
        </section>
    );
}
