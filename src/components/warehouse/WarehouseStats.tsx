import React, { useMemo } from 'react';
import { Warehouse } from 'lucide-react';
import { ZoneData } from './types';

interface ZoneStatProps {
    name: string;
    total: number;
    used: number;
    color: 'blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'indigo' | 'orange' | 'cyan';
}

function ZoneStatCard({ name, total, used, color }: ZoneStatProps) {
    const empty = Math.max(0, total - used);
    const percent = total > 0 ? Math.round((used / total) * 100) : 0;

    const colorStyles: Record<string, string> = {
        blue: 'bg-blue-50/50 text-blue-700 border-blue-100',
        emerald: 'bg-emerald-50/50 text-emerald-700 border-emerald-100',
        amber: 'bg-amber-50/50 text-amber-700 border-amber-100',
        purple: 'bg-purple-50/50 text-purple-700 border-purple-100',
        rose: 'bg-rose-50/50 text-rose-700 border-rose-100',
        indigo: 'bg-indigo-50/50 text-indigo-700 border-indigo-100',
        orange: 'bg-orange-50/50 text-orange-700 border-orange-100',
        cyan: 'bg-cyan-50/50 text-cyan-700 border-cyan-100',
    };

    return (
        <div className={`flex flex-col p-3 rounded-2xl border shadow-sm transition-all hover:shadow-md min-w-[240px] flex-1 ${colorStyles[color] || colorStyles.blue}`}>
            <div className="flex justify-between items-center mb-2 text-stone-900">
                <h3 className="font-black text-sm flex items-center gap-2 truncate">
                    <div className="p-1 rounded-lg bg-white/60 shadow-sm shrink-0">
                        <Warehouse size={14} />
                    </div>
                    {name}
                </h3>
                <span className="text-[10px] font-black px-2 py-0.5 bg-white/60 rounded-full shrink-0">
                    {percent}% đầy
                </span>
            </div>

            <div className="flex gap-2">
                <div className="flex-1 bg-white/40 p-1.5 rounded-xl border border-white/40 text-center">
                    <div className="text-[8px] font-bold uppercase opacity-50">Tổng</div>
                    <div className="font-black text-sm leading-none mt-0.5">{total}</div>
                </div>
                <div className="flex-1 bg-white/40 p-1.5 rounded-xl border border-white/40 text-center">
                    <div className="text-[8px] font-bold uppercase opacity-50">Dùng</div>
                    <div className="font-black text-sm leading-none mt-0.5">{used}</div>
                </div>
                <div className="flex-1 bg-white p-1.5 rounded-xl border-2 border-current shadow-sm text-center">
                    <div className="text-[8px] font-black uppercase">Trống</div>
                    <div className="font-black text-base leading-none mt-0.5">{empty}</div>
                </div>
            </div>
        </div>
    );
}

interface WarehouseStatsProps {
    zones: ZoneData[];
    isLoading?: boolean;
}

export default function WarehouseStats({ zones, isLoading }: WarehouseStatsProps) {
    const colors = ['blue', 'emerald', 'amber', 'purple', 'rose', 'indigo', 'orange', 'cyan'] as const;

    // Recursive helper to count positions in a zone tree
    const countPositions = (zone: ZoneData): { total: number, used: number } => {
        let total = zone.positions?.length || 0;
        let used = zone.positions?.filter(p => p.lot_id).length || 0;

        if (zone.children) {
            zone.children.forEach(child => {
                const childStats = countPositions(child);
                total += childStats.total;
                used += childStats.used;
            });
        }

        return { total, used };
    };

    const stats = useMemo(() => {
        return zones.map((zone, index) => {
            const { total, used } = countPositions(zone);
            return {
                name: zone.name,
                total,
                used,
                color: colors[index % colors.length]
            };
        });
    }, [zones]);

    if (isLoading && zones.length === 0) {
        return (
            <div className="flex gap-4 mb-6 overflow-hidden">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-24 flex-1 bg-zinc-100 rounded-2xl animate-pulse"></div>
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-wrap lg:flex-nowrap gap-4 mb-6">
            {stats.map((stat, index) => (
                <ZoneStatCard key={index} {...stat} />
            ))}
        </div>
    );
}
