import ExcelJS from "exceljs";
import prisma from "./prisma";

export async function generateCampaignReport(campaignId: string) {
    const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { links: true }
    });

    if (!campaign) throw new Error("Campaign not found");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Submission Results");

    // Calculate Summary Stats
    const total = campaign.links.length;
    const success = campaign.links.filter(l => l.status === "SUCCESS").length;
    const failed = campaign.links.filter(l => l.status === "FAILED").length;
    const pending = campaign.links.filter(l => l.status === "PENDING" || l.status === "PROCESSING").length;

    // Add Summary Section
    worksheet.addRow(["Campaign Report", campaign.name]);
    worksheet.addRow(["Generated At", new Date().toLocaleString()]);
    worksheet.addRow([]);
    worksheet.addRow(["SUMMARY STATISTICS"]);
    worksheet.addRow(["Total Links", total]);
    worksheet.addRow(["Successful", success]);
    worksheet.addRow(["Failed", failed]);
    worksheet.addRow(["Pending", pending]);
    worksheet.addRow([]);

    // Main Data Header using row 10 (or after summary)
    const headerRow = worksheet.addRow(["URL", "Status", "Error/Details", "Timestamp"]);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4F46E5" }, // Indigo-600
    };

    worksheet.columns = [
        { key: "url", width: 50 },
        { key: "status", width: 15 },
        { key: "error", width: 40 },
        { key: "createdAt", width: 25 },
    ];

    campaign.links.forEach(link => {
        worksheet.addRow({
            url: link.url,
            status: link.status,
            error: link.error || "-",
            createdAt: link.createdAt.toISOString(),
        });
    });



    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
}
