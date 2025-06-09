/**
 * Processes a GitHub repository URL and converts it to a single HTML file
 */
import { processZipFile } from "./zip-processing"

export async function processGithubRepo(url: string): Promise<string> {
  // Validate GitHub URL
  if (!isValidGithubUrl(url)) {
    throw new Error("Invalid GitHub repository URL")
  }

  try {
    // Extract owner and repo from URL
    const { owner, repo } = extractRepoInfo(url)

    // Try multiple approaches to fetch the repository
    const zipBlob = await fetchGithubRepo(owner, repo)

    // Convert blob to File object for processing
    const file = new File([zipBlob], `${repo}.zip`, { type: "application/zip" })

    // Use the zip processing function to handle the rest
    return await processZipFile(file)
  } catch (error) {
    console.error("Error processing GitHub repository:", error)
    throw new Error("Failed to process GitHub repository. Please check the URL and try again.")
  }
}

async function fetchGithubRepo(owner: string, repo: string): Promise<Blob> {
  const corsProxies = [
    // Using allorigins.win as a CORS proxy
    `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://api.github.com/repos/${owner}/${repo}/zipball`)}`,
    
    // Alternative: Direct download URL with CORS proxy
    `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://github.com/${owner}/${repo}/archive/refs/heads/main.zip`)}`,
    
    // Another CORS proxy option
    `https://corsproxy.io/?${encodeURIComponent(`https://github.com/${owner}/${repo}/archive/refs/heads/main.zip`)}`,
    
    // Try with master branch as fallback
    `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://github.com/${owner}/${repo}/archive/refs/heads/master.zip`)}`
  ]

  let lastError: Error | null = null

  for (const proxyUrl of corsProxies) {
    try {
      console.log(`Trying to fetch from: ${proxyUrl}`)
      
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/zip, application/octet-stream, */*',
        },
      })

      if (response.ok) {
        const blob = await response.blob()
        
        // Verify it's actually a zip file
        if (blob.size > 0) {
          console.log(`Successfully fetched ${blob.size} bytes`)
          return blob
        }
      } else {
        console.warn(`Proxy failed with status: ${response.status}`)
      }
    } catch (error) {
      console.warn(`Proxy ${proxyUrl} failed:`, error)
      lastError = error as Error
      continue
    }
  }

  // If all proxies fail, try the GitHub API approach with different endpoints
  try {
    return await fetchWithGithubAPI(owner, repo)
  } catch (apiError) {
    console.error("GitHub API approach also failed:", apiError)
    throw lastError || new Error("All download methods failed")
  }
}

async function fetchWithGithubAPI(owner: string, repo: string): Promise<Blob> {
  // Try to get repository information first
  const repoInfoUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://api.github.com/repos/${owner}/${repo}`)}`
  
  try {
    const repoResponse = await fetch(repoInfoUrl)
    if (repoResponse.ok) {
      const repoData = await repoResponse.json()
      const repoInfo = JSON.parse(repoData.contents)
      
      // Get the default branch
      const defaultBranch = repoInfo.default_branch || 'main'
      
      // Try to download using the default branch
      const downloadUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://github.com/${owner}/${repo}/archive/refs/heads/${defaultBranch}.zip`)}`
      
      const response = await fetch(downloadUrl)
      if (response.ok) {
        return await response.blob()
      }
    }
  } catch (error) {
    console.warn("Failed to get repo info:", error)
  }

  throw new Error("Failed to fetch repository using GitHub API")
}

function isValidGithubUrl(url: string): boolean {
  // Enhanced validation for GitHub URLs
  const githubRegex = /^https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/?$/
  return githubRegex.test(url.replace(/\/$/, ''))
}

function extractRepoInfo(url: string): { owner: string; repo: string } {
  // Remove trailing slash and any additional paths
  const cleanUrl = url.replace(/\/$/, '').split('?')[0].split('#')[0]
  
  // Extract owner and repo from URL
  const parts = cleanUrl.split("/")
  
  if (parts.length < 5) {
    throw new Error("Invalid GitHub URL format")
  }
  
  const owner = parts[3]
  const repo = parts[4]

  if (!owner || !repo) {
    throw new Error("Could not extract owner and repository name from URL")
  }

  return { owner, repo }
}