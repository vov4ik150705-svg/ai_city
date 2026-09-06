export function memoryRootStore() {
    const minutes = new Map();
    const days = new Map();
    return {
        putMinute(wallS, root) {
            minutes.set(wallS.toString(), root);
        },
        getMinute(wallS) {
            return minutes.get(wallS.toString());
        },
        putCityDay(key, cid) {
            days.set(key, cid);
        },
        getCityDay(key) {
            return days.get(key);
        },
    };
}
