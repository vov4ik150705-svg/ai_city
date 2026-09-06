export function memoryStore() {
    const rows = new Map();
    return {
        putPriceDay(cityDay, payload) {
            rows.set(cityDay.toString(), payload);
        },
        getPriceDay(cityDay) {
            return rows.get(cityDay.toString());
        },
    };
}
