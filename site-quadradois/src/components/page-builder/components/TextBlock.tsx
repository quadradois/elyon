/**
 * TextBlock Component
 */
import { ComponentProps } from '../types';

export default function TextBlock(props: ComponentProps) {
    const {
        title, // CRM envia title
        content,
        alignment = 'left',
        background_color = 'transparent',
        text_color = 'inherit',
        padding_y = 'medium'
    } = props;

    const alignClass = {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right',
        justify: 'text-justify'
    }[alignment as string] || 'text-left';

    const paddingClass = {
        none: 'py-0',
        small: 'py-8',
        medium: 'py-16',
        large: 'py-24'
    }[padding_y as string] || 'py-16';

    return (
        <section
            className={`${paddingClass}`}
            style={{ backgroundColor: background_color, color: text_color }}
        >
            <div className={`container mx-auto px-4 ${alignClass}`}>
                {title && (
                    <h2 className="text-3xl font-bold mb-6">{title}</h2>
                )}
                <div
                    className="prose prose-lg max-w-4xl mx-auto text-inherit"
                    dangerouslySetInnerHTML={{ __html: content || '' }}
                />
            </div>
        </section>
    );
}
