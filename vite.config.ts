import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === 'true' && repositoryName

// https://vite.dev/config/
export default defineConfig({
  base: isGitHubPagesBuild ? `/${repositoryName}/` : '/',
  plugins: [tailwindcss(), react()],
})
