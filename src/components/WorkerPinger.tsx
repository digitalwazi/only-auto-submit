"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WorkerPinger() {
    const router = useRouter();

    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch("/api/worker/run");
                if (res.ok) {
                    // Revalidate the page data if something was processed
                    router.refresh();
                }
            } catch (e) {
                console.error("Worker ping failed", e);
            }
        }, 10000); // Ping every 10 seconds

        return () => clearInterval(interval);
    }, [router]);

    return null; // Invisible component
}
