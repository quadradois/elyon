/**
 * ImageGallery Component
 */
import { ComponentProps } from '../types';

export default function ImageGallery(props: ComponentProps) {
    const {
        images = [],
        layout = 'grid', // grid, masonry, slider
        columns = 3
    } = props;

    if (!images || images.length === 0) return null;

    const gridCols = {
        2: 'md:grid-cols-2',
        3: 'md:grid-cols-3',
        4: 'md:grid-cols-4'
    }[columns as number] || 'md:grid-cols-3';

    // Simple Grid Implementation
    if (layout === 'grid' || layout === 'masonry') {
        return (
            <section className="py-12">
                <div className="container mx-auto px-4">
                    <div className={`grid grid-cols-1 ${gridCols} gap-4`}>
                        {images.map((img: string, idx: number) => (
                            <div key={idx} className="aspect-[4/3] overflow-hidden rounded-lg group text-center bg-gray-100">
                                <img
                                    src={img}
                                    alt={`Gallery ${idx + 1}`}
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    // Slider Implementation (Simple CSS Snap or Overflow)
    return (
        <section className="py-12">
            <div className="container mx-auto px-4">
                <div className="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hide">
                    {images.map((img: string, idx: number) => (
                        <div key={idx} className="snap-center shrink-0 w-[80vw] md:w-[400px] aspect-[16/9] rounded-lg overflow-hidden bg-gray-100">
                            <img
                                src={img}
                                alt={`Slide ${idx + 1}`}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
