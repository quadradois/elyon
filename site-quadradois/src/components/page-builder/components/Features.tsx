/**
 * Features Component (Diferenciais) - Premium Design
 * Conceito: "Trust Blocks" - Cards premium com gradientes e micro-interações
 */
'use client';

import { ComponentProps } from '../types';
import * as Icons from 'lucide-react';
import { motion, Variants } from 'framer-motion';

export default function Features(props: ComponentProps) {
    const {
        title,
        subtitle,
        items = [],
        columns = 3
    } = props;

    // Dynamic Icon Renderer
    const renderIcon = (iconName: string) => {
        const Icon = (Icons as any)[iconName] || Icons.CheckCircle;
        return <Icon className="w-8 h-8 text-white stroke-[1.5]" />;
    };

    const gridCols = {
        2: 'md:grid-cols-2',
        3: 'md:grid-cols-3',
        4: 'md:grid-cols-4'
    }[columns as number] || 'md:grid-cols-3';

    // Animation Variants
    const containerVariants: Variants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2
            }
        }
    };

    const itemVariants: Variants = {
        hidden: { opacity: 0, y: 30 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                type: "spring",
                stiffness: 50,
                damping: 20
            }
        }
    };

    return (
        <section className="py-24 md:py-32 relative overflow-hidden">
            {/* Background with subtle gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50" />

            {/* Decorative Background Elements */}
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[var(--color-primary)]/5 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-[var(--color-secondary)]/5 rounded-full blur-[120px] translate-x-1/3 translate-y-1/3" />

            <div className="container mx-auto px-4 relative z-10">
                {/* Section Header */}
                {title && (
                    <div className="text-center mb-20 md:mb-24">
                        {/* Badge */}
                        <motion.span
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="inline-block px-5 py-2 bg-[var(--color-primary)]/5 text-[var(--color-primary)] text-xs font-bold tracking-[0.2em] uppercase rounded-full mb-6 border border-[var(--color-primary)]/10"
                        >
                            Nossos Diferenciais
                        </motion.span>

                        {/* Title */}
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#1E3958] mb-6 tracking-tight"
                        >
                            {title}
                        </motion.h2>

                        {/* Decorative Line */}
                        <motion.div
                            initial={{ opacity: 0, scaleX: 0 }}
                            whileInView={{ opacity: 1, scaleX: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                            className="flex items-center justify-center gap-2 mb-8"
                        >
                            <div className="w-16 h-1.5 rounded-full bg-[var(--color-primary)]" />
                            <div className="w-4 h-4 rounded-full bg-[var(--color-secondary)] animate-pulse" />
                            <div className="w-16 h-1.5 rounded-full bg-[var(--color-primary)]" />
                        </motion.div>

                        {/* Subtitle */}
                        {subtitle && (
                            <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.3 }}
                                className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed"
                            >
                                {subtitle}
                            </motion.p>
                        )}
                    </div>
                )}

                {/* Features Grid */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-100px" }}
                    className={`grid grid-cols-1 ${gridCols} gap-8 md:gap-10`}
                >
                    {items.map((item: any, idx: number) => (
                        <motion.div
                            key={idx}
                            variants={itemVariants}
                            className="group relative"
                        >
                            <div className="h-full bg-white/80 backdrop-blur-xl rounded-[2rem] p-10 
                                          shadow-[0_8px_30px_rgba(0,0,0,0.04)] 
                                          border border-white/50
                                          hover:shadow-[0_20px_40px_rgba(30,57,88,0.08)] 
                                          hover:border-[var(--color-primary)]/20 
                                          hover:-translate-y-2 
                                          transition-all duration-500 ease-out"
                            >
                                {/* Number Badge Background */}
                                <span className="absolute top-8 right-8 text-8xl font-black text-slate-50 pointer-events-none select-none group-hover:text-[var(--color-primary)]/5 transition-colors duration-500">
                                    {String(idx + 1).padStart(2, '0')}
                                </span>

                                {/* Icon Container */}
                                <div className="relative w-20 h-20 mb-8">
                                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] rounded-2xl opacity-10 group-hover:opacity-20 transition-opacity duration-500 rotate-6 group-hover:rotate-12" />
                                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] rounded-2xl shadow-lg shadow-[var(--color-primary)]/20 flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                                        {renderIcon(item.icon)}

                                        {/* Inner Glow */}
                                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="relative z-10">
                                    <h3 className="text-2xl font-bold text-[#1E3958] mb-4 group-hover:text-[var(--color-primary)] transition-colors duration-300">
                                        {item.title}
                                    </h3>
                                    <p className="text-slate-600 leading-relaxed text-base">
                                        {item.description}
                                    </p>
                                </div>

                                {/* Bottom Accent Line */}
                                <div className="absolute bottom-0 left-10 right-10 h-1 bg-gradient-to-r from-transparent via-[var(--color-primary)]/40 to-transparent opacity-0 transform scale-x-0 group-hover:opacity-100 group-hover:scale-x-100 transition-all duration-500" />
                            </div>
                        </motion.div>
                    ))}
                </motion.div>

                {/* CTA Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.6 }}
                    className="text-center mt-20 md:mt-24"
                >
                    <a
                        href="/sobre"
                        className="group inline-flex items-center gap-3 text-[var(--color-primary)] font-bold text-lg hover:text-[var(--color-secondary)] transition-colors duration-300"
                    >
                        <span className="border-b-2 border-[var(--color-primary)] group-hover:border-[var(--color-secondary)] transition-colors duration-300">
                            Conheça Nossa História
                        </span>
                        <Icons.ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                    </a>
                </motion.div>
            </div>
        </section>
    );
}

// Add display name for debugging
Features.displayName = 'Features';
