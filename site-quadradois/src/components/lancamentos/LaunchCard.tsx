import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Calendar, ArrowRight } from 'lucide-react';
import type { Lancamento } from '@/lib/api';

interface LaunchCardProps {
    launch: Lancamento;
    primaryColor?: string;
}

export default function LaunchCard({ launch, primaryColor }: LaunchCardProps) {
    const formatPrice = (value: number | null) => {
        if (!value) return null;
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const minPrice = launch.tipologias?.reduce((min, t) =>
        t.preco_inicial && (!min || t.preco_inicial < min) ? t.preco_inicial : min
        , null as number | null);

    return (
        <Link href={`/lancamentos/${launch.slug}`} className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100">
            <div className="relative aspect-[16/9] overflow-hidden">
                <Image
                    src={launch.imagem_capa || 'https://via.placeholder.com/800x450?text=Lançamento'}
                    alt={launch.nome}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span className="absolute top-4 left-4 px-3 py-1.5 text-xs font-bold text-white rounded-full uppercase tracking-wider" style={{ backgroundColor: primaryColor || '#0ea5e9' }}>
                    {launch.status === 'pre_lancamento' ? 'Pré-lançamento' : launch.status === 'lancamento' ? 'Lançamento' : launch.status === 'em_obras' ? 'Em obras' : 'Pronto'}
                </span>
                {launch.logo_empreendimento && (
                    <div className="absolute bottom-4 left-4">
                        <Image src={launch.logo_empreendimento} alt={launch.nome} width={100} height={40} className="h-8 w-auto object-contain" />
                    </div>
                )}
            </div>
            <div className="p-5">
                <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-1 group-hover:text-primary transition-colors">{launch.nome}</h3>
                {launch.construtora && <p className="text-sm text-gray-500 mb-3">por {launch.construtora}</p>}
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                    {launch.bairro && (
                        <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span>{launch.bairro}, {launch.cidade}</span>
                        </div>
                    )}
                    {launch.previsao_entrega && (
                        <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(launch.previsao_entrega).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    {minPrice ? (
                        <div>
                            <p className="text-xs text-gray-400">A partir de</p>
                            <p className="text-lg font-bold" style={{ color: primaryColor || '#0ea5e9' }}>{formatPrice(minPrice)}</p>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">Consulte valores</p>
                    )}
                    <span className="flex items-center gap-1 text-sm font-semibold group-hover:gap-2 transition-all" style={{ color: primaryColor || '#0ea5e9' }}>
                        Ver detalhes <ArrowRight className="w-4 h-4" />
                    </span>
                </div>
            </div>
        </Link>
    );
}
