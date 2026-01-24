
import prisma from "@/lib/prisma";
import { ArrowLeft, CheckCircle, XCircle, Clock, AlertTriangle, Download } from "lucide-react";
import Link from "next/link";

export default async function CampaignDetailsPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params;

    const campaign = await prisma.campaign.findUnique({
        where: { id },
        include: {
            _count: {
                select: { links: true }
            }
        }
    });

    if (!campaign) {
        return <div className="p-8 text-center text-red-400">Campaign not found</div>;
    }

    // Fetch links with pagination (initially just show first 100 or so, simplified for now)
    const links = await prisma.link.findMany({
        where: { campaignId: id },
        orderBy: { updatedAt: 'desc' },
        take: 500
    });

    // Fetch accurate global stats
    const statsGroup = await prisma.link.groupBy({
        by: ['status'],
        where: { campaignId: id },
        _count: { status: true }
    });

    const stats = {
        success: statsGroup.find(s => s.status === "SUCCESS")?._count.status || 0,
        failed: statsGroup.find(s => s.status === "FAILED")?._count.status || 0,
        pending: statsGroup.find(s => s.status === "PENDING" || s.status === "PROCESSING")?._count.status || 0
    };
    // Pending logic might need summation if grouping separates PENDING/PROCESSING
    const pendingCount = statsGroup.filter(s => s.status === "PENDING" || s.status === "PROCESSING").reduce((acc, curr) => acc + curr._count.status, 0);
    stats.pending = pendingCount;

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/" className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold mb-1">{campaign.name}</h1>
                        <p className="text-slate-400 text-sm">Campaign ID: <span className="font-mono">{campaign.id}</span></p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <a
                        href={`/api/reports/${campaign.id}`}
                        className="btn-primary flex items-center gap-2"
                        target="_blank"
                        download
                    >
                        <Download className="w-4 h-4" />
                        Download Report
                    </a>
                </div>
            </header>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 rounded-2xl border-l-4 border-l-emerald-500">
                    <div className="flex items-center gap-3 mb-2 text-emerald-400">
                        <CheckCircle className="w-5 h-5" />
                        <h3 className="font-bold">Success</h3>
                    </div>
                    <p className="text-3xl font-mono font-bold">{stats.success}</p>
                </div>
                <div className="glass-card p-6 rounded-2xl border-l-4 border-l-rose-500">
                    <div className="flex items-center gap-3 mb-2 text-rose-400">
                        <XCircle className="w-5 h-5" />
                        <h3 className="font-bold">Failed</h3>
                    </div>
                    <p className="text-3xl font-mono font-bold">{stats.failed}</p>
                </div>
                <div className="glass-card p-6 rounded-2xl border-l-4 border-l-amber-500">
                    <div className="flex items-center gap-3 mb-2 text-amber-400">
                        <Clock className="w-5 h-5" />
                        <h3 className="font-bold">Pending</h3>
                    </div>
                    <p className="text-3xl font-mono font-bold">{stats.pending}</p>
                </div>
            </div>

            {/* Links Table */}
            <div className="glass-card rounded-2xl overflow-hidden">
                <div className="max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-white/5 sticky top-0 backdrop-blur-md z-10">
                            <tr>
                                <th className="p-4 font-bold text-sm text-slate-300">URL</th>
                                <th className="p-4 font-bold text-sm text-slate-300 w-32">Status</th>
                                <th className="p-4 font-bold text-sm text-slate-300 w-1/3">Message / Error</th>
                                <th className="p-4 font-bold text-sm text-slate-300 w-48 text-right">Last Updated</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {links.map(link => (
                                <tr key={link.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 font-mono text-sm max-w-md truncate" title={link.url}>
                                        <a href={link.url} target="_blank" className="hover:text-indigo-400 hover:underline">
                                            {link.url}
                                        </a>
                                    </td>
                                    <td className="p-4">
                                        <StatusBadge status={link.status} />
                                    </td>
                                    <td className="p-4 text-sm text-slate-400 font-mono">
                                        {link.error ? (
                                            <span className="text-rose-400 flex items-center gap-2">
                                                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                                {link.error}
                                            </span>
                                        ) : (
                                            link.status === 'SUCCESS' ? <span className="text-emerald-500/50">Submission verified</span> : '-'
                                        )}
                                    </td>
                                    <td className="p-4 text-sm text-slate-500 text-right font-mono">
                                        {new Date(link.updatedAt).toLocaleTimeString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {links.length >= 500 && (
                    <div className="p-3 text-center text-xs text-slate-500 border-t border-white/5">
                        Showing last 500 links. Download full report for all data.
                    </div>
                )}
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const statusColors: any = {
        SUCCESS: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
        FAILED: "text-rose-400 bg-rose-400/10 border-rose-400/20",
        PENDING: "text-slate-400 bg-slate-400/10 border-slate-400/20",
        PROCESSING: "text-amber-400 bg-amber-400/10 border-amber-400/20 animate-pulse",
    };
    return (
        <span className={`px-2 py-1 rounded text-[10px] font-bold border uppercase tracking-wide ${statusColors[status] || "text-slate-500"}`}>
            {status}
        </span>
    );
}
