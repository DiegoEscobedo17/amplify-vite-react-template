import { defineFunction } from '@aws-amplify/backend';
export const posService = defineFunction({
    entry: './handler.ts',
    timeoutSeconds: 60,
    memoryMB: 1024,
});
