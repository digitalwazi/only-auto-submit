"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X, Loader2 } from "lucide-react";
import { createCampaign } from "@/lib/actions";

export default function CreateCampaignModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, setIsPending] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsPending(true);
        const formData = new FormData(e.currentTarget);

        // Default form fields config
        const fields = [
            { name: "name", label: "Full Name", value: formData.get("field_name") },
            { name: "email", label: "Email Address", value: formData.get("field_email") },
            { name: "message", label: "Comment/Message", value: formData.get("field_message") },
        ];
        formData.append("fields", JSON.stringify(fields));

        await createCampaign(formData);
        setIsPending(false);
        setIsOpen(false);
    }

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="w-full btn-primary flex items-center justify-center gap-2 py-3"
            >
                <Plus className="w-5 h-5" />
                New Campaign
            </button>
        );
    }

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="glass-card w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border-white/20 max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-white/10 flex justify-between items-center sticky top-0 bg-slate-900/50 backdrop-blur-xl z-10">
                    <h3 className="text-xl font-bold">Create New Campaign</h3>
                    <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-400">Campaign Name</label>
                            <input name="name" required placeholder="Real Estate Leads" className="w-full glass-input" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-400">Description</label>
                            <input name="description" placeholder="Automated outreach..." className="w-full glass-input" />
                        </div>
                    </div>

                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-indigo-400">Auto-fill values</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <input name="field_name" required placeholder="Your Name" className="glass-input text-sm" />
                            <input name="field_email" required type="email" placeholder="Your Email" className="glass-input text-sm" />
                        </div>
                        <textarea name="field_message" required placeholder="Comment or Message to submit..." className="w-full glass-input text-sm h-24 resize-none" />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-400">Links (One per line)</label>
                        <textarea
                            name="links"
                            required
                            placeholder="https://example.com/contact&#10;https://foo.bar/support"
                            className="w-full glass-input h-40 font-mono text-xs leading-relaxed"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-white/10 sticky bottom-0 bg-slate-900/50 backdrop-blur-xl p-4 -mx-6 -mb-6 z-10">
                        <button type="button" onClick={() => setIsOpen(false)} className="btn-glass px-6">Cancel</button>
                        <button disabled={isPending} type="submit" className="btn-primary min-w-[140px] flex items-center justify-center gap-2">
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Campaign"}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
