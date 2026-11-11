export type Detail = {
    modality?: string;
    tokenCount?: number;
};
// Prices USD / 1M tokens, checked 2026-11-11. Estimates, not invoices.
export function estimate(input: Detail[], output: Detail[]) {
    let usd = 0, unknown = 0;
    for (const [details, rates] of [[input, { AUDIO: 3.5 }], [output, { AUDIO: 21 }]] as const)
        for (const d of details) {
            const rate = rates[d.modality as keyof typeof rates];
            if (rate === undefined)
                unknown += d.tokenCount ?? 0;
            else
                usd += (d.tokenCount ?? 0) * rate / 1e6;
        }
    return { usd, unknown };
}
