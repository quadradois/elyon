# Design System - CRM Quadra Dois

## Visão Holística da Interface

Este documento consolida todos os padrões visuais, tokens de design e componentes do CRM Quadra Dois para garantir consistência no Elyon.

---

## 🎨 Cores (Brand)

### Cores Principais
```css
/* Brand Navy - Cor primária */
--brand-navy: #1E3958;
--brand-navy-light: #2a4d73;
--brand-navy-lighter: #4A7BA7;
--brand-navy-dark: #152840;

/* Brand Yellow - Cor de destaque */
--brand-yellow: #FFD23F;
--brand-yellow-light: #ffe066;
--brand-yellow-lighter: #fff7d6;
--brand-yellow-dark: #e6bd2d;
```

### Cores Semânticas
```css
/* Backgrounds */
--background: #FFFFFF;           /* Fundo geral */
--surface: #F7F8F9;              /* Cards, panels */
--surface-hover: #EEEFF1;        /* Hover em surfaces */

/* Texto */
--text-primary: #2E333C;         /* Texto principal */
--text-secondary: #6A717F;       /* Texto secundário */
--text-tertiary: rgba(106, 113, 127, 0.8); /* Texto terciário */

/* Bordas */
--border: #E0E7EF;               /* Bordas padrão */
--border-hover: rgba(224, 231, 239, 0.85); /* Bordas em hover */

/* Status */
--success: #22C55E;              /* Verde */
--warning: #F59E0B;              /* Laranja */
--error: #EF4444;                /* Vermelho */
--info: #0EA5E9;                 /* Azul */
```

---

## 📐 Espaçamentos

```css
--spacing-xs: 0.25rem;   /* 4px */
--spacing-sm: 0.5rem;    /* 8px */
--spacing-md: 1rem;      /* 16px */
--spacing-lg: 1.5rem;    /* 24px - Padrão para cards */
--spacing-xl: 2rem;      /* 32px */
--spacing-2xl: 3rem;     /* 48px */
--spacing-3xl: 4rem;     /* 64px */
```

---

## 🔤 Tipografia

### Fontes
```css
font-family: 'Inter', system-ui, sans-serif;
font-family-display: 'Poppins', 'Inter', system-ui, sans-serif;
```

### Tamanhos
```css
--fontSize-xs: 0.75rem;    /* 12px - Labels, badges */
--fontSize-sm: 0.875rem;   /* 14px - Corpo, descrições */
--fontSize-base: 1rem;     /* 16px - Padrão */
--fontSize-lg: 1.125rem;   /* 18px - Títulos de seção */
--fontSize-xl: 1.25rem;    /* 20px */
--fontSize-2xl: 1.5rem;    /* 24px - Títulos principais */
--fontSize-3xl: 1.875rem;  /* 30px */
--fontSize-4xl: 2.25rem;   /* 36px */
```

### Pesos
```css
--fontWeight-normal: 400;
--fontWeight-medium: 500;
--fontWeight-semibold: 600;
--fontWeight-bold: 700;
```

---

## 🔲 Border Radius

```css
--borderRadius-sm: 0.125rem;   /* 2px */
--borderRadius-md: 0.375rem;   /* 6px */
--borderRadius-lg: 0.5rem;     /* 8px */
--borderRadius-xl: 0.75rem;    /* 12px - Cards menores */
--borderRadius-2xl: 1rem;      /* 16px - Cards principais */
--borderRadius-full: 9999px;   /* Circular - Avatares, badges */
```

---

## 🌫️ Sombras

```css
/* Sombras suaves para cards */
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);

/* Sombras especiais */
--shadow-soft: 0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06);
--shadow-soft-lg: 0 10px 40px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.06);
```

---

## 📦 Padrões de Componentes

### Card Padrão
```tsx
// Estrutura base de card
<div className="bg-surface rounded-xl p-6 border border-border/30 shadow-sm hover:shadow-md transition-shadow duration-200">
  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
    <Icon className="w-5 h-5 text-primary" />
    Título da Seção
  </h3>
  {/* Conteúdo */}
</div>
```

### Card Variants
```tsx
// Default
className="bg-surface border border-border"

// Glass
className="bg-white/5 backdrop-blur-md border border-white/10"

// Accent
className="bg-brand-yellow/5 border border-brand-yellow/20"

// Elevated
className="bg-surface border border-border shadow-soft-lg"
```

### Campo de Dados
```tsx
// Campo com ícone
<div className="flex items-start gap-3 p-3 bg-background/50 rounded-lg border border-border/30 hover:border-primary/30 transition-colors">
  <Icon className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
  <div className="flex-1 min-w-0">
    <p className="text-xs text-text-secondary mb-1">Label</p>
    <p className="text-sm text-text-primary font-medium">Valor</p>
  </div>
</div>
```

### Header com Gradient
```tsx
// Header estilo premium
<div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-primary/5 border border-primary/20 p-6">
  <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
  <div className="relative z-10">
    {/* Conteúdo */}
  </div>
</div>
```

### Avatar
```tsx
// Avatar circular
<div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
  <User className="w-6 h-6 text-primary" />
</div>

// Com inicial
<div className="w-12 h-12 rounded-full bg-brand-navy text-white flex items-center justify-center text-lg font-bold">
  {nome.charAt(0).toUpperCase()}
</div>
```

---

## 🏷️ Badges

### Status Badge
```tsx
// Sucesso
className="bg-success/10 text-success border border-success/20"

// Pendente/Warning
className="bg-warning/10 text-warning border border-warning/20"

// Erro
className="bg-error/10 text-error border border-error/20"

// Info
className="bg-blue-500/10 text-blue-600 border border-blue-500/20"
```

### Classification Badge (Temperatura)
```tsx
// Frio
className="bg-blue-500/10 text-blue-600 border-blue-500/30"

// Morno
className="bg-orange-500/10 text-orange-600 border-orange-500/30"

// Quente
className="bg-red-500/10 text-red-600 border-red-500/30"
```

---

## 🎭 Animações

### Keyframes Disponíveis
```css
/* Fade In */
@keyframes fadeIn { 0% { opacity: 0 } 100% { opacity: 1 } }

/* Fade In Up */
@keyframes fadeInUp {
  0% { opacity: 0; transform: translateY(10px) }
  100% { opacity: 1; transform: translateY(0) }
}

/* Slide In Right */
@keyframes slideInRight {
  0% { transform: translateX(-10px); opacity: 0 }
  100% { transform: translateX(0); opacity: 1 }
}

/* Scale In */
@keyframes scaleIn {
  0% { transform: scale(0.95); opacity: 0 }
  100% { transform: scale(1); opacity: 1 }
}

/* Shimmer (loading) */
@keyframes shimmer {
  0% { background-position: -1000px 0 }
  100% { background-position: 1000px 0 }
}

/* Pulse Soft */
@keyframes pulseSoft {
  0%, 100% { opacity: 1 }
  50% { opacity: 0.7 }
}
```

### Classes de Animação
```tsx
animate-fade-in
animate-fade-in-up
animate-slide-in-right
animate-scale-in
animate-shimmer
animate-pulse-soft
```

### Stagger Animation (Listas)
```tsx
// Aplica delay progressivo em itens de lista
<div className="stagger-item" style={{ animationDelay: '0.05s' }}>Item 1</div>
<div className="stagger-item" style={{ animationDelay: '0.1s' }}>Item 2</div>
```

---

## 🖼️ Efeitos Especiais

### Glass Morphism
```css
.glass {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
```

### Hover Lift
```tsx
className="hover:shadow-soft-lg hover:-translate-y-1 cursor-pointer transition-all duration-300"
```

### Glow on Hover
```tsx
className="hover:shadow-[0_0_20px_rgba(2,132,199,0.4)]"
```

---

## 📱 Layout de Página (Grid 12 colunas)

### Página de Detalhes (3 colunas)
```tsx
<div className="p-6 space-y-6">
  {/* Header com gradient */}
  <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-primary/5 p-6">
    {/* Avatar, nome, badges, ações */}
  </div>

  {/* Grid de 3 colunas */}
  <div className="grid grid-cols-12 gap-6">
    {/* Esquerda: Dados pessoais */}
    <div className="col-span-12 lg:col-span-3">
      <Card>Informações de Contato</Card>
    </div>

    {/* Centro: Timeline/Conversas */}
    <div className="col-span-12 lg:col-span-6">
      <Card>Timeline de Atividades</Card>
    </div>

    {/* Direita: Imóvel/Relacionados */}
    <div className="col-span-12 lg:col-span-3">
      <Card>Imóvel</Card>
    </div>
  </div>
</div>
```

---

## 🔘 Botões

### Variantes
```tsx
// Primary (brand navy)
className="bg-primary text-white hover:bg-primary/90 shadow-md hover:shadow-lg"

// Accent (brand yellow) - CTA principal
className="bg-brand-yellow text-brand-navy hover:bg-brand-yellow-dark shadow-lg font-bold"

// Secondary
className="bg-surface text-text-primary border border-border hover:bg-border"

// Ghost
className="text-text-secondary hover:bg-surface hover:text-text-primary"

// Danger
className="bg-danger text-white hover:bg-danger/90"

// Outline
className="border-2 border-primary text-primary hover:bg-primary hover:text-white"
```

### Tamanhos
```tsx
// Small
className="h-8 px-3 text-xs gap-1.5"

// Medium (default)
className="h-10 px-4 text-sm gap-2"

// Large
className="h-12 px-6 text-base gap-2"
```

---

## 📋 Timeline

### Estrutura
```tsx
<div className="relative pl-8 pb-4 last:pb-0">
  {/* Linha vertical */}
  <div className="absolute left-2.5 top-6 bottom-0 w-0.5 bg-gradient-to-b from-primary/30 to-transparent" />
  
  {/* Dot */}
  <div className="absolute left-0 top-1.5 w-5 h-5 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
    <CheckCircle2 className="w-2.5 h-2.5 text-primary" />
  </div>
  
  {/* Conteúdo */}
  <div className="bg-background/50 border border-border/40 rounded-lg p-4 hover:border-primary/30 hover:shadow-sm transition-all">
    <h4 className="text-sm font-semibold text-text-primary">Título</h4>
    <p className="text-sm text-text-secondary">Descrição</p>
  </div>
</div>
```

---

## 🎯 Resumo: Classes Mais Usadas

### Cards
- `bg-surface rounded-xl p-6 border border-border/30 shadow-sm hover:shadow-md transition-shadow duration-200`

### Campos de Info
- `flex items-start gap-3 p-3 bg-background/50 rounded-lg border border-border/30 hover:border-primary/30 transition-colors`

### Títulos de Seção
- `text-lg font-semibold mb-4 flex items-center gap-2`

### Labels
- `text-xs text-text-secondary mb-1`

### Valores
- `text-sm text-text-primary font-medium`

### Ícones em campos
- `w-4 h-4 text-primary mt-0.5 flex-shrink-0`

### Transições
- `transition-all duration-200`
- `transition-colors`
- `transition-shadow duration-200`

---

## 📝 Aplicação no Elyon

Para manter consistência visual com o CRM Quadra Dois no Elyon:

1. **Usar as mesmas cores** - Especialmente brand-navy e brand-yellow
2. **Mesmo padrão de cards** - rounded-xl, p-6, border-border/30
3. **Campos de dados uniformes** - Ícone + label + valor
4. **Headers com gradient** - from-primary/10 via-accent/5 to-primary/5
5. **Animações sutis** - fade-in-up, hover effects
6. **Layout em grid** - 12 colunas, responsivo

Isso garante que usuários que usam ambos os sistemas tenham uma experiência familiar e coesa.
