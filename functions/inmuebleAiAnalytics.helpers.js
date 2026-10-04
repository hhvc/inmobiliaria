const INPUT_USD_PER_MILLION = 0.10;
const OUTPUT_USD_PER_MILLION = 0.50;

const safeNumber = (value) => {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const emptyCounters = () => ({
    attempts: 0,
    successes: 0,
    failures: 0,
    processing: 0,
    inputTokens: 0,
    outputTokens: 0,
    latencyTotalMs: 0,
    latencySamples: 0,
    appliedDrafts: 0,
    appliedFields: 0,
    usefulFeedback: 0,
    improvementFeedback: 0,
});

const addEvent = (counters, event = {}) => {
    counters.attempts += 1;

    if (event.status === "success") counters.successes += 1;
    else if (event.status === "failure") counters.failures += 1;
    else counters.processing += 1;

    counters.inputTokens += safeNumber(event.inputTokens);
    counters.outputTokens += safeNumber(event.outputTokens);

    const latencyMs = safeNumber(event.latencyMs);
    if (latencyMs > 0) {
        counters.latencyTotalMs += latencyMs;
        counters.latencySamples += 1;
    }

    if (event.applied === true) {
        counters.appliedDrafts += 1;
        counters.appliedFields += safeNumber(event.appliedFieldCount);
    }

    if (event.feedback === "useful") counters.usefulFeedback += 1;
    if (event.feedback === "needs_improvement") {
        counters.improvementFeedback += 1;
    }
};

export const estimateAiDraftCostUsd = ({
    inputTokens = 0,
    outputTokens = 0,
} = {}) => (
    (safeNumber(inputTokens) * INPUT_USD_PER_MILLION / 1000000) +
    (safeNumber(outputTokens) * OUTPUT_USD_PER_MILLION / 1000000)
);

export const normalizeAiAnalyticsDateKey = (value = "") => {
    const dateKey = value?.toString().trim().slice(0, 10) || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return "";
    const parsed = new Date(`${dateKey}T12:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === dateKey ? dateKey : "";
};

export const getAiAnalyticsRangeDays = (fromKey, toKey) => {
    const from = new Date(`${fromKey}T12:00:00.000Z`).getTime();
    const to = new Date(`${toKey}T12:00:00.000Z`).getTime();
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
        return Number.POSITIVE_INFINITY;
    }
    return Math.floor((to - from) / 86400000) + 1;
};

export const finalizeAiDraftCounters = (value = {}) => {
    const counters = {...emptyCounters(), ...value};
    const feedbackTotal = counters.usefulFeedback +
        counters.improvementFeedback;

    return {
        attempts: counters.attempts,
        successes: counters.successes,
        failures: counters.failures,
        processing: counters.processing,
        inputTokens: counters.inputTokens,
        outputTokens: counters.outputTokens,
        totalTokens: counters.inputTokens + counters.outputTokens,
        appliedDrafts: counters.appliedDrafts,
        appliedFields: counters.appliedFields,
        usefulFeedback: counters.usefulFeedback,
        improvementFeedback: counters.improvementFeedback,
        feedbackTotal,
        successRate: counters.attempts > 0 ?
            counters.successes / counters.attempts : 0,
        applicationRate: counters.successes > 0 ?
            counters.appliedDrafts / counters.successes : 0,
        usefulRate: feedbackTotal > 0 ?
            counters.usefulFeedback / feedbackTotal : 0,
        averageLatencyMs: counters.latencySamples > 0 ?
            Math.round(counters.latencyTotalMs / counters.latencySamples) : 0,
        estimatedCostUsd: estimateAiDraftCostUsd(counters),
    };
};

export const aggregateAiDraftEvents = (events = []) => {
    const summary = emptyCounters();
    const daily = new Map();
    const agencies = new Map();
    const failures = new Map();
    const models = new Map();

    events.forEach((event = {}) => {
        addEvent(summary, event);

        const dayKey = normalizeAiAnalyticsDateKey(event.dayKey) || "sin_fecha";
        if (!daily.has(dayKey)) daily.set(dayKey, emptyCounters());
        addEvent(daily.get(dayKey), event);

        const agencyId = event.inmobiliariaId?.toString().trim() || "particular";
        if (!agencies.has(agencyId)) agencies.set(agencyId, emptyCounters());
        addEvent(agencies.get(agencyId), event);

        if (event.status === "failure") {
            const failureKey = event.failureType?.toString().trim() ||
                event.failureStatus?.toString().trim() || "unknown";
            failures.set(failureKey, (failures.get(failureKey) || 0) + 1);
        }

        const model = event.model?.toString().trim();
        if (model) models.set(model, (models.get(model) || 0) + 1);
    });

    return {
        summary: finalizeAiDraftCounters(summary),
        daily: [...daily.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([dayKey, counters]) => ({
                dayKey,
                ...finalizeAiDraftCounters(counters),
            })),
        agencies: [...agencies.entries()]
            .map(([inmobiliariaId, counters]) => ({
                inmobiliariaId,
                ...finalizeAiDraftCounters(counters),
            }))
            .sort((left, right) => right.attempts - left.attempts),
        failures: [...failures.entries()]
            .map(([type, total]) => ({type, total}))
            .sort((left, right) => right.total - left.total),
        models: [...models.entries()]
            .map(([model, total]) => ({model, total}))
            .sort((left, right) => right.total - left.total),
    };
};

