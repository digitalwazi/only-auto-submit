"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function WorkerPinger() {
    const router = useRouter();
    const isRunning = useRef(false);

    useEffect(() => {
        const pingWorker = async () => {
            if (isRunning.current) return;
            isRunning.current = true;

            try {
                // Trigger the worker to process a batch
                const res = await fetch("/api/worker/process", { method: "POST" });
                const data = await res.json();

                if (data.status === "ACTIVE" || data.status === "COMPLETED_CAMPAIGN") {
                    console.log("Worker Pulse:", data);
                    // Optional: refresh router if campaign completed
                    if (data.status === "COMPLETED_CAMPAIGN") {
                        router.refresh();
                    }
                }
            } catch (e) {
                console.error("Worker connection failed", e);
            } finally {
                isRunning.current = false;
            }
        };

        // Poll every 5 seconds to keep the queue moving
        const interval = setInterval(pingWorker, 5000); // 5s gap

        // Initial ping
        pingWorker();

        return () => clearInterval(interval);
    }, [router]);

    return null; // Invisible component
}
