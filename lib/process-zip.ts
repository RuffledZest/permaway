/**
 * Processes a zip file and converts it to a single HTML file
 */
export async function processZipFile(file: File): Promise<string> {
  try {
    // Import JSZip dynamically to avoid server-side issues
    const JSZip = (await import("jszip")).default

    // Read the zip file
    const zip = await JSZip.loadAsync(file)

    // Extract files from the zip
    const files: Record<string, string> = {}
    const promises: Promise<void>[] = []

    zip.forEach((path, zipEntry) => {
      if (!zipEntry.dir) {
        // Only process text files (HTML, CSS, JS, etc.)
        const isTextFile = /\.(html|htm|css|js|json|txt|md|xml|svg)$/i.test(path)

        if (isTextFile) {
          const promise = zipEntry
            .async("text")
            .then((content) => {
              files[path] = content
            })
            .catch((error) => {
              console.warn(`Failed to read file ${path}:`, error)
            })
          promises.push(promise)
        }
      }
    })

    await Promise.all(promises)

    // Process the extracted files and convert to a single HTML file
    return await convertToSingleHtml(files)
  } catch (error) {
    console.error("Error processing zip file:", error)
    throw new Error("Failed to process zip file. Please check the file and try again.")
  }
}

async function convertToSingleHtml(files: Record<string, string>): Promise<string> {
  // Identify project type and main files
  const projectType = identifyProjectType(files)

  // For simplicity in this demo, we'll create a basic HTML with embedded content
  // In a real implementation, this would be much more sophisticated

  let html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n'
  html += '  <meta charset="UTF-8">\n'
  html += '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
  html += "  <title>Deployed Project</title>\n"

  // Add CSS
  html += "  <style>\n"

  // Find and embed CSS files
  Object.entries(files).forEach(([path, content]) => {
    if (path.endsWith(".css")) {
      html += `/* ${path} */\n${content}\n\n`
    }
  })

  html += "  </style>\n</head>\n<body>\n"

  // Add HTML content
  let mainHtmlContent = ""

  // Find index.html or similar
  const indexFile = Object.keys(files).find((path) => path.endsWith("index.html") || path.match(/\/index\.html$/))

  if (indexFile) {
    // Extract body content from index.html
    const content = files[indexFile]
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i)

    if (bodyMatch && bodyMatch[1]) {
      mainHtmlContent = bodyMatch[1].trim()
    } else {
      // If no body tags found, use the whole content
      mainHtmlContent = content
    }
  } else {
    // Create a basic content if no index.html found
    mainHtmlContent = '<div id="app"></div>'
  }

  html += mainHtmlContent + "\n\n"

  // Add JavaScript
  html += "  <script>\n"

  // Find and embed JS files
  Object.entries(files).forEach(([path, content]) => {
    if (path.endsWith(".js") && !path.includes("node_modules")) {
      html += `// ${path}\n${content}\n\n`
    }
  })

  html += "  </script>\n</body>\n</html>"

  // Optimize the HTML to reduce size
  return optimizeHtml(html)
}

function identifyProjectType(files: Record<string, string>): string {
  // Check for package.json to identify project type
  const packageJsonFile = Object.keys(files).find((path) => path.endsWith("package.json"))

  if (packageJsonFile) {
    try {
      const packageJson = JSON.parse(files[packageJsonFile])

      if (packageJson.dependencies) {
        if (packageJson.dependencies["next"]) {
          return "nextjs"
        } else if (packageJson.dependencies["react"]) {
          return "react"
        } else if (packageJson.dependencies["vue"]) {
          return "vue"
        }
      }
    } catch (e) {
      console.error("Error parsing package.json:", e)
    }
  }

  // Check for specific files to identify project type
  if (Object.keys(files).some((path) => path.includes("next.config"))) {
    return "nextjs"
  } else if (Object.keys(files).some((path) => path.includes("vite.config"))) {
    return "vite"
  }

  return "static" // Default to static HTML
}

function optimizeHtml(html: string): string {
  // Basic optimization: remove comments, extra whitespace, etc.
  return html
    .replace(/<!--[\s\S]*?-->/g, "") // Remove HTML comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // Remove CSS comments
    .replace(/\/\/.*$/gm, "") // Remove single-line JS comments
    .replace(/\s{2,}/g, " ") // Replace multiple spaces with a single space
    .replace(/>\s+</g, "><") // Remove whitespace between HTML tags
}
