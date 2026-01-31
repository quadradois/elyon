/**
 * Component Types
 * Definições de tipos para os componentes do construtor de páginas
 */

export interface ComponentItem {
    id: string;
    type: string;
    props: Record<string, any>;
}

export type ComponentProps = Record<string, any>;
