import { notFound } from 'next/navigation';
import SiteLayout from '@/components/layout/SiteLayout';
import { getTenantProperty, getDomainFromHeaders } from '@/lib/tenant';
import PreviewBanner from '@/components/PreviewBanner';
import { resolveConfigWithFallback } from '@/lib/utils/resolveConfigWithFallback';
import PropertyDetail from '@/components/properties/PropertyDetail';
import { Metadata } from 'next';

interface PropertyCustomPageProps {
    params: {
        slug: string;
    };
    searchParams: {
        preview?: string;
        draft?: string;
    };
}

export async function generateMetadata({ params }: PropertyCustomPageProps): Promise<Metadata> {
    const domain = getDomainFromHeaders();
    const property = await getTenantProperty(domain, params.slug);

    if (!property) {
        return {
            title: 'Imóvel não encontrado',
        };
    }

    return {
        title: property.titulo,
        description: property.descricao?.slice(0, 160),
        openGraph: {
            images: property.imagem_principal ? [property.imagem_principal] : [],
        },
    };
}

export default async function PropertyPage({ params, searchParams }: PropertyCustomPageProps) {
    const isPreview = searchParams.preview === 'true';
    const isDraft = searchParams.draft === 'true';

    const domain = getDomainFromHeaders();
    const config = await resolveConfigWithFallback(domain, { preview: isPreview, draft: isDraft });

    const property = await getTenantProperty(domain, params.slug);

    if (!property) {
        notFound();
    }

    // Adaptar dados do backend para interface Property
    // (O getTenantProperty do tenant.ts já deve retornar algo próximo, mas vamos garantir o shape)
    const activeProperty = {
        id: property.id,
        codigo: property.property_code ?? String(property.id),
        titulo: property.title ?? '',
        descricao: property.description ?? null,
        tipo: 'Imóvel', // Fixo por enquanto
        finalidade: property.sale_price ? 'Venda' : 'Aluguel',
        valor: property.sale_price ?? property.rent_price ?? null,
        area_total: property.area ?? null, // O backend corrigido mapeia 'area' corretamente agora? Ver site_public_routes
        quartos: property.bedrooms ?? null,
        banheiros: property.bathrooms ?? null,
        vagas: property.parking_spots ?? null,
        endereco: '',
        bairro: property.address_neighborhood ?? null,
        cidade: property.address_city ?? null,
        estado: '',
        imagem_principal: property.image_urls?.[0] ?? null,
        fotos: property.image_urls ?? [],
        destaque: false,
    };

    return (
        <>
            {isPreview && <PreviewBanner />}
            <SiteLayout config={config}>
                <main className="py-12 md:py-16 bg-gray-50 min-h-screen">
                    <div className="container-site">
                        <PropertyDetail
                            property={activeProperty}
                            primaryColor={config.branding.primary_color}
                        />
                    </div>
                </main>
            </SiteLayout>
        </>
    );
}
