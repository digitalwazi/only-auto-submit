"use client";

import { useState, useEffect } from "react";
import { Play, Pause, FileSpreadsheet, Trash2, Loader2 } from "lucide-react";
import { toggleCampaign, deleteCampaign } from "@/lib/actions";
import { getCampaignProgress } from "@/lib/stats";

export default function CampaignActions({ campaign }: { campaign: any }) {
    const [isPending, setIsPending] = useState(false);

    // Live Stats State
    const [stats, setStats] = useState({
        status: campaign.status,
        success: campaign.links?.filter((l: any) => l.status === 'SUCCESS').length || 0,
        total: campaign._count.links || 0
    });

    // Polling Effect
    useEffect(() => {
        let interval: NodeJS.Timeout;

        async function fetchStats() {
            // Only poll if it was recently running or we think it is running
            if (stats.status === "RUNNING") {
                const latest = await getCampaignProgress(campaign.id);
                if (latest) {
                    setStats({
                        status: latest.status,
                        success: latest.success,
                        total: latest.total
                    });
                }
            }
        }

        // Poll every 3 seconds
        if (stats.status === "RUNNING") {
            fetchStats(); // Initial fetch
            interval = setInterval(fetchStats, 3000);
        }

        return () => clearInterval(interval);
    }, [stats.status, campaign.id]);


    async function handleToggle() {
        setIsPending(true);
        try {
            // Toggle optimistcally
            const newStatus = stats.status === "RUNNING" ? "PAUSED" : "RUNNING";
            await toggleCampaign(campaign.id, stats.status);

            // Force an immediate update
            const latest = await getCampaignProgress(campaign.id);
            if (latest) {
                setStats({
                    status: latest.status,
                    success: latest.success,
                    total: latest.total
                });
            } else {
                setStats(prev => ({ ...prev, status: newStatus }));
            }

        } catch (e) {
            console.error(e);
        }
        setIsPending(false);
    }

    async function handleDelete() {
        if (confirm("Are you sure you want to delete this campaign? All links will be removed.")) {
            setIsPending(true);
            await deleteCampaign(campaign.id);
            setIsPending(false);
        }
    }

    function handleReport() {
        window.location.href = `/api/reports/${campaign.id}`;
    }

    return (
        <>
            <div className="flex justify-between items-start mb-6">
                <StatusBadge status={stats.status} />
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={handleDelete}
                        disabled={isPending}
                        className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <h3 className="text-xl font-bold mb-2 truncate">{campaign.name}</h3>
            <p className="text-slate-400 text-sm line-clamp-2 mb-6 h-10">{campaign.description || "No description provided."}</p>

            {/* Live Progress */}
            <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 flex items-center gap-2">Progress</span>
                    <span className="font-mono font-bold text-slate-300">
                        {stats.success} / {stats.total}
                    </span>
                </div>
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                    <div
                        className="bg-indigo-500 h-full transition-all duration-1000 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                        style={{ width: `${(stats.success / (stats.total || 1) * 100)}%` }}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={handleToggle}
                    disabled={isPending}
                    className="btn-glass flex items-center justify-center gap-2 text-sm"
                >
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                        stats.status === 'RUNNING' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />
                    )}
                    {stats.status === 'RUNNING' ? 'Pause' : 'Start'}
                </button>
                <button
                    onClick={handleReport}
                    className="btn-glass flex items-center justify-center gap-2 text-sm text-indigo-400 border-indigo-500/20"
                >
                    <FileSpreadsheet className="w-4 h-4" />
                    Report
                </button>
            </div>
        </>
    );
}

function StatusBadge({ status }: { status: string }) {
    const statusColors: any = {
        RUNNING: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
        PAUSED: "text-amber-400 bg-amber-400/10 border-amber-400/20",
        STOPPED: "text-rose-400 bg-rose-400/10 border-rose-400/20",
        COMPLETED: "text-indigo-400 bg-indigo-400/10 border-indigo-400/20",
    };
    return (
        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColors[status] || "text-slate-400 bg-slate-400/10"}`}>
            {status}
        </div>
    );
}
