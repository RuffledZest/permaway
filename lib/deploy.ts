/**
 * Deploys HTML content to Arweave using the provided API
 */
export async function deployToArweave(html: string): Promise<{
  success: boolean
  links: string[]
}> {
  try {
    const response = await fetch("https://aoile-backend.onrender.com/deploy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ html }),
    })

    if (!response.ok) {
      throw new Error(`Deployment failed with status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error deploying to Arweave:", error)
    throw new Error("Failed to deploy to Arweave. Please try again.")
  }
}
