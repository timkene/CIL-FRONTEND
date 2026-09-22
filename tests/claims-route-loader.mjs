import { pathToFileURL } from 'node:url'
import { resolve as resolvePath } from 'node:path'

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') return { url: 'data:text/javascript,', shortCircuit: true }
  if (specifier === 'next/server') return nextResolve('next/server.js', context)
  if (specifier.startsWith('@/')) {
    return { url: pathToFileURL(resolvePath(process.cwd(), specifier.slice(2) + '.ts')).href,
             shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
