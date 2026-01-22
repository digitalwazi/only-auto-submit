"use server";

import prisma from "./prisma";
import { revalidatePath } from "next/cache";

export async function getSettings() {
    let settings = await prisma.globalSettings.findUnique({
        where: { id: 1 },
    });

    if (!settings) {
        settings = await prisma.globalSettings.create({
            data: {
                id: 1,
                concurrency: 4, // Default to 4 threads
                isWorkerOn: true,
            },
        });
    }

    return settings;
}

export async function updateSettings(concurrency: number, isWorkerOn: boolean) {
    if (concurrency < 1) concurrency = 1;
    if (concurrency > 10) concurrency = 10; // Safety cap

    const settings = await prisma.globalSettings.upsert({
        where: { id: 1 },
        update: { concurrency, isWorkerOn },
        create: {
            id: 1,
            concurrency,
            isWorkerOn,
        },
    });

    revalidatePath("/");
    return settings;
}
