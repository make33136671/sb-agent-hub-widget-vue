import { getConfig } from '../config'

const logger = {
  verbose: (tag: string, ...args: unknown[]) => getConfig().logLevel >= 6 && console.log(`[${tag}]`, ...args),
  debug:   (tag: string, ...args: unknown[]) => getConfig().logLevel >= 5 && console.log(`[${tag}]`, ...args),
  info:    (tag: string, ...args: unknown[]) => getConfig().logLevel >= 4 && console.log(`[${tag}]`, ...args),
  warn:    (tag: string, ...args: unknown[]) => getConfig().logLevel >= 3 && console.warn(`[${tag}]`, ...args),
  error:   (tag: string, ...args: unknown[]) => getConfig().logLevel >= 2 && console.error(`[${tag}]`, ...args),
}

export default logger
