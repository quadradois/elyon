/**
 * Componente auxiliar para exibir um item de informação
 */

interface InfoItemProps {
    label: string;
    value: string | null;
    icon?: React.ReactNode;
    fullWidth?: boolean;
}

export function InfoItem({ label, value, icon, fullWidth = false }: InfoItemProps) {
    return (
        <div className={fullWidth ? 'col-span-full' : ''}>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                {icon}
                {label}
            </p>
            <p className="font-medium text-slate-700">
                {value || <span className="text-slate-400">Não informado</span>}
            </p>
        </div>
    );
}
