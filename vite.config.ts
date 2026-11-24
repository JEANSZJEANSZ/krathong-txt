/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
	base: '/',
	plugins: [svelte()],
	test: {
		include: ['src/**/*.test.ts', 'worker/**/*.test.ts'],
		environment: 'node',
	},
});
