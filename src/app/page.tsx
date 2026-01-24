import prisma from "@/lib/prisma";
import WorkerControls from "@/components/WorkerControls";
import CampaignActions from "@/components/CampaignActions";
import WorkerPinger from "@/components/WorkerPinger";
import LiveTerminal from "@/components/LiveTerminal";
import { Globe } from "lucide-react";

export default async function Dashboard() {
  const campaigns = await prisma.campaign.findMany({
    include: {
      links: {
        select: { status: true }
      },
      _count: {
        select: { links: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const hasRunning = campaigns.some(c => c.status === "RUNNING");

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {hasRunning && <WorkerPinger />}

      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold mb-2 tracking-tight">Campaigns</h2>
          <p className="text-slate-400">Manage and monitor your automated submission campaigns.</p>
        </div>
        <div className="flex gap-3">
          <div className="text-right px-4">
            <div className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold mb-1">Global processing</div>
            <div className="text-2xl font-mono font-bold text-indigo-400 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${hasRunning ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`} />
              {campaigns.reduce((acc, c) => acc + c._count.links, 0).toLocaleString()} <span className="text-xs text-slate-600 font-normal">links</span>
            </div>
          </div>
        </div>
      </header>

      <WorkerControls />
      <LiveTerminal /> {/* Added LiveTerminal below WorkerControls */}

      {campaigns.length === 0 ? (
        <div className="glass-card rounded-[2.5rem] p-24 text-center">
          <div className="w-24 h-24 bg-gradient-to-tr from-indigo-500/10 to-violet-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-white/5">
            <Globe className="w-10 h-10 text-indigo-500/50" />
          </div>
          <h3 className="text-2xl font-bold mb-4">No active campaigns</h3>
          <p className="text-slate-500 mb-10 max-w-sm mx-auto leading-relaxed">Ready to automate? Create a campaign, import your links, and let our system handle the forms for you.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="glass-card rounded-[2rem] p-8 glass-card-hover group border-white/10">
              <CampaignActions campaign={campaign} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

