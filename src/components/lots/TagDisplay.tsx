import { ChevronRight } from "lucide-react";

interface TagDisplayProps {
    tags?: string[];
    className?: string;
    placeholderMap?: Record<string, string>; // Replace specific parts (like @) with dynamic values
    variant?: 'default' | 'compact';
}

export function TagDisplay({ tags, className = "", placeholderMap = {}, variant = 'default' }: TagDisplayProps) {
    if (!tags || tags.length === 0) return null;

    const isCompact = variant === 'compact';

    return (
        <div className={`flex flex-wrap gap-1 ${isCompact ? 'justify-center' : 'gap-2'} ${className}`}>
            {tags.map((tag, idx) => {
                const parts = tag.split(">");

                // If simple tag and no placeholder needed, just render
                if (parts.length === 1 && !parts[0].includes('@')) {
                    return (
                        <span
                            key={`${tag}-${idx}`}
                            className={`inline-flex items-center rounded font-mono border ${isCompact
                                ? 'px-1 py-[1px] text-[7px] bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400 border-orange-200/50'
                                : 'px-2 py-1 bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 text-xs font-medium border border-orange-200 dark:border-orange-800'
                                }`}
                        >
                            {tag}
                        </span>
                    );
                }

                // Render hierarchy
                return (
                    <span
                        key={`${tag}-${idx}`}
                        className={`inline-flex items-center rounded font-mono border ${isCompact
                            ? 'px-1 py-[1px] text-[7px] bg-orange-50/50 text-orange-900 dark:bg-orange-950/10 dark:text-orange-300 border-orange-100/50'
                            : 'px-1.5 py-0.5 bg-orange-50 text-orange-900 dark:bg-orange-900/20 dark:text-orange-300 text-xs border border-orange-200 dark:border-orange-800'
                            }`}
                    >
                        {parts.map((rawPart, pIdx) => {
                            const part = rawPart.trim();

                            if (part.includes('@')) {
                                const productDisplay = placeholderMap['@'] || '@';
                                const renderedPart = part.replace('@', productDisplay);
                                return (
                                    <span key={pIdx} className="flex items-center">
                                        {pIdx > 0 && <ChevronRight size={isCompact ? 8 : 10} className="mx-0.5 text-slate-400" />}
                                        <span className={`font-bold rounded border ${isCompact
                                            ? 'bg-indigo-50/50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 px-0.5 border-indigo-100/30'
                                            : 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1 border border-indigo-100 dark:border-indigo-800/50'
                                            }`}>
                                            {renderedPart}
                                        </span>
                                    </span>
                                )
                            }

                            return (
                                <span key={pIdx} className="flex items-center">
                                    {pIdx > 0 && <ChevronRight size={isCompact ? 8 : 10} className="mx-0.5 text-slate-400" />}
                                    <span className="font-bold">
                                        {part}
                                    </span>
                                </span>
                            );
                        })}
                    </span>
                );
            })}
        </div>
    );
}
