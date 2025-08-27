import { defineFunction } from '@aws-amplify/backend';
export const psCreateSale = defineFunction({
    entry: './handler.ts',
    timeoutSeconds: 60,
    memoryMB: 1024,
});
