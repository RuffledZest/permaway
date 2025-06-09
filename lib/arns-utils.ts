import { ANT, ArweaveSigner, IO } from '@ar.io/sdk'

// Wallet connection utilities
export async function connectWallet(): Promise<string> {
  try {
    // Check if ArConnect is available
    if (typeof window !== 'undefined' && (window as any).arweaveWallet) {
      // Request permissions
      await (window as any).arweaveWallet.connect(['ACCESS_ADDRESS', 'SIGN_TRANSACTION'])
      
      // Get wallet address
      const address = await (window as any).arweaveWallet.getActiveAddress()
      return address
    } else {
      throw new Error('ArConnect wallet not found. Please install ArConnect extension.')
    }
  } catch (error) {
    console.error('Error connecting wallet:', error)
    throw new Error('Failed to connect wallet. Please make sure ArConnect is installed and try again.')
  }
}

export async function getWalletAddress(): Promise<string | null> {
  try {
    if (typeof window !== 'undefined' && (window as any).arweaveWallet) {
      const address = await (window as any).arweaveWallet.getActiveAddress()
      return address
    }
    return null
  } catch (error) {
    return null
  }
}

// ARNS utilities
export interface ArnsName {
  name: string
  processId: string
  undername?: string
}

export async function getArnsNames(walletAddress: string): Promise<ArnsName[]> {
  try {
    console.log('Fetching ARNS names for address:', walletAddress)
    
    // Use the same API endpoints as in the other project
    const registryUrl = 'https://cu.ardrive.io/dry-run?process-id=i_le_yKKPVstLTDSmkHRqf-wYphMnwB9OhleiTgMkWc'
    const namesUrl = 'https://cu.ardrive.io/dry-run?process-id=qNvAoz0TgcH7DMg8BCVn8jF32QH5L6T29VjHxhHqqGE'
    
    const headers = {
      'accept': '*/*',
      'content-type': 'application/json',
      'origin': 'https://arns.app',
      'referer': 'https://arns.app/'
    }

    // First API call to get owned process IDs
    const registryBody = JSON.stringify({
      Id: "1234",
      Target: "i_le_yKKPVstLTDSmkHRqf-wYphMnwB9OhleiTgMkWc",
      Owner: "1234",
      Anchor: "0",
      Data: "1234",
      Tags: [
        { name: "Action", value: "Access-Control-List" },
        { name: "Address", value: walletAddress },
        { name: "Data-Protocol", value: "ao" },
        { name: "Type", value: "Message" },
        { name: "Variant", value: "ao.TN.1" }
      ]
    })

    const registryResponse = await fetch(registryUrl, { method: 'POST', headers, body: registryBody })
    if (!registryResponse.ok) throw new Error(`Registry API error: ${registryResponse.status}`)
    
    const registryData = JSON.parse(await registryResponse.text())
    
    let ownedProcessIds: string[] = []
    if (registryData.Messages?.[0]?.Data) {
      const ownedData = JSON.parse(registryData.Messages[0].Data)
      ownedProcessIds = ownedData.Owned || []
    }

    // If no owned process IDs, return empty array
    if (ownedProcessIds.length === 0) return []

    // Second API call to get names for owned process IDs (with pagination)
    let cursor = ""
    const processIdToItem = new Map<string, any>()
    let keepPaging = true

    while (keepPaging) {
      const tags = [
        { name: "Action", value: "Paginated-Records" },
        { name: "Limit", value: "1000" },
        { name: "Data-Protocol", value: "ao" },
        { name: "Type", value: "Message" },
        { name: "Variant", value: "ao.TN.1" }
      ]
      
      if (cursor) tags.push({ name: "Cursor", value: cursor })

      const namesBody = JSON.stringify({
        Id: "1234",
        Target: "qNvAoz0TgcH7DMg8BCVn8jF32QH5L6T29VjHxhHqqGE",
        Owner: "1234",
        Anchor: "0",
        Data: "1234",
        Tags: tags
      })

      const namesResponse = await fetch(namesUrl, { method: 'POST', headers, body: namesBody })
      if (!namesResponse.ok) throw new Error(`Names API error: ${namesResponse.status}`)

      const namesText = await namesResponse.text()
      const namesData = JSON.parse(namesText)
      
      if (namesData.Messages?.[0]?.Data) {
        const parsedData = JSON.parse(namesData.Messages[0].Data)
        const items = parsedData.items || []
        
        // Check if any item matches our process IDs
        for (const item of items) {
          if (ownedProcessIds.includes(item.processId)) {
            processIdToItem.set(item.processId, item)
          }
        }

        if (parsedData.nextCursor) {
          cursor = parsedData.nextCursor
        } else {
          keepPaging = false
        }
      } else {
        keepPaging = false
      }
    }

    // Return the matches we found
    const userArnsNames: ArnsName[] = ownedProcessIds.map(processId => {
      const item = processIdToItem.get(processId)
      if (item) {
        return {
          name: item.name,
          processId: item.processId,
          undername: '@' // Default undername
        }
      } else {
        return {
          name: processId, // Fallback to processId if name not found
          processId,
          undername: '@'
        }
      }
    }).filter(item => item.name !== item.processId) // Filter out items where name equals processId
    
    console.log('Found ARNS names:', userArnsNames)
    return userArnsNames
    
  } catch (error) {
    console.error('Error fetching ARNS names:', error)
    throw new Error('Failed to fetch ARNS names. Please try again.')
  }
}

export async function migrateToArns(
  processId: string, 
  undername: string, 
  arweaveUrl: string
): Promise<{ arnsUrl: string; transactionId: string }> {
  try {
    // Extract transaction ID from arweave URL
    const txIdMatch = arweaveUrl.match(/\/([a-zA-Z0-9_-]+)$/)
    if (!txIdMatch) {
      throw new Error('Invalid Arweave URL format')
    }
    
    const transactionId = txIdMatch[1]
    console.log('Migrating transaction ID:', transactionId)
    console.log('To ANT process:', processId)
    console.log('With undername:', undername)
    
    // Check if ArConnect is available
    if (typeof window === 'undefined' || !(window as any).arweaveWallet) {
      throw new Error('ArConnect wallet not found')
    }
    
    // Create signer using ArConnect
    const signer = new ArweaveSigner((window as any).arweaveWallet)
    
    // Initialize ANT
    const ant = ANT.init({ processId, signer })
    
    // Update the undername record
    const result = await ant.setRecord({
      undername: undername,
      transactionId: transactionId,
      ttlSeconds: 3600 // 1 hour TTL
    }, {
      tags: [
        { name: 'App-Name', value: 'ARNS-Migration-Tool' },
        { name: 'Migration-Source', value: arweaveUrl },
        { name: 'Timestamp', value: new Date().toISOString() }
      ]
    })
    
    // Get the ARNS name from the process ID by fetching all records
    const io = IO.init()
    const arnsRecords = await io.getArNSRecords()
    
    let arnsName = ''
    for (const [name, record] of Object.entries(arnsRecords)) {
      if (record.processId === processId) {
        arnsName = name
        break
      }
    }
    
    if (!arnsName) {
      throw new Error('Could not find ARNS name for the given process ID')
    }
    
    // Construct the final ARNS URL
    const arnsUrl = undername === '@' || !undername 
      ? `https://${arnsName}.ar.io`
      : `https://${undername}_${arnsName}.ar.io`
    
    console.log('Migration successful:', {
      arnsUrl,
      transactionId: result.id || 'pending'
    })
    
    return {
      arnsUrl,
      transactionId: result.id || 'pending'
    }
    
  } catch (error) {
    console.error('Error during migration:', error)
    throw new Error(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Utility function to validate Arweave transaction ID
export function isValidArweaveId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{43}$/.test(id)
}

// Utility function to extract transaction ID from various Arweave URL formats
export function extractTransactionId(url: string): string | null {
  const patterns = [
    /arweave\.net\/([a-zA-Z0-9_-]{43})/,
    /ar\.io\/([a-zA-Z0-9_-]{43})/,
    /\/([a-zA-Z0-9_-]{43})$/
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && isValidArweaveId(match[1])) {
      return match[1]
    }
  }
  
  return null
}