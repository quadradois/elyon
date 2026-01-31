/**
 * Map Component
 */
import { ComponentProps } from '../types';

export default function Map(props: ComponentProps) {
    const {
        address,
        latitude,
        longitude,
        zoom = 15,
        height = '400px'
    } = props;

    // Se temos coords: usar maps embed com coords
    // Se temos address: usar maps embed com address
    // Preferencia por address para busca simples, ou coords se preciso.

    // Google Maps Embed (iframe simples sem key para busca básica ou com key se configurado)
    // Para production, idealmente usar Google Maps JavaScript API ou Embed API com Key.
    // Usando iframe genérico de busca por enquanto.

    const query = address ? encodeURIComponent(address) : '';
    const src = `https://maps.google.com/maps?q=${query}&t=&z=${zoom}&ie=UTF8&iwloc=&output=embed`;

    if (!address && (!latitude || !longitude)) return null;

    return (
        <section className="w-full">
            <div className="w-full bg-gray-200" style={{ height }}>
                <iframe
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    scrolling="no"
                    marginHeight={0}
                    marginWidth={0}
                    src={src}
                    title="Map"
                />
            </div>
        </section>
    );
}
