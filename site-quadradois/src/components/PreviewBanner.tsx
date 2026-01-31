'use client';

export default function PreviewBanner() {
    const handleExit = () => {
        // Remove query params e recarrega
        const url = new URL(window.location.href);
        url.searchParams.delete('preview');
        url.searchParams.delete('draft');
        window.location.href = url.toString();
    };

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-orange-500 text-white text-center py-2 text-sm font-medium shadow-lg">
            ⚠️ Modo de visualização
            <button
                onClick={handleExit}
                className="underline ml-2 hover:text-orange-100 transition-colors"
            >
                Sair
            </button>
        </div>
    );
}
