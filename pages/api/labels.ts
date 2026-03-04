import type { NextApiRequest, NextApiResponse } from 'next'
import { labelEngine } from '@/lib/label-engine'
import type { AddressLabel } from '@/lib/types'

// Ensure the singleton is loaded on first request
let initialized = false

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Record<string, AddressLabel> | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Lazy-load data on first request (happens once per server lifecycle)
  if (!initialized) {
    labelEngine.load()
    initialized = true
  }

  const { addresses } = req.body as { addresses?: string[] }

  if (!Array.isArray(addresses)) {
    return res.status(400).json({ error: 'Expected { addresses: string[] }' })
  }

  // Safety limit — max 500 addresses per request
  if (addresses.length > 500) {
    return res.status(400).json({ error: 'Max 500 addresses per request' })
  }

  const labels = labelEngine.getLabels(addresses)
  return res.status(200).json(labels)
}
