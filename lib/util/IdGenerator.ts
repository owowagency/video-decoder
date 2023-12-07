class IdGenerator {
    private static current: Record<string, number> = {};

    static generate(label: string): string {
        if (label in this.current) {
            this.current[label]++;
            const count = this.current[label];
            return `${label}:${count}`;
        }

        const count = 1;
        this.current[label] = count;
        return `${label}:${count}`;
    }
}

export default IdGenerator;